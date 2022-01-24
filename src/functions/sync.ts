import { Session } from "@inrupt/solid-client-authn-node";
import { LBDserver } from "lbdserver-client-api";
import { newEngine } from "@comunica/actor-init-sparql";
import { DCAT, LDP } from "@inrupt/vocab-common-rdf";
import { extract } from "jsonld-remote";

const { LbdProject, LbdService, LbdDataset, LbdDistribution, vocabulary } = LBDserver;
const { LBD } = vocabulary;
const {
  uploadRdfToTripleStore,
  getAllGraphs,
  deleteResource,
  querySparql,
  uploadResource,
  createRepository,
} = require("./tripleStore");
const { getLDPcontent } = require("./auxiliaries");
const { log } = require("../util/logger");

// construct the resources in the Pod in a recursive way
async function constructTree(root, session, recursiveArray?) {
  const resources = await getLDPcontent([root], session);
  for (const res of resources) {
    recursiveArray.push(res);
    if (res.endsWith("/")) {
      recursiveArray = await constructTree(res, session, recursiveArray);
    }
  }
  return recursiveArray;
}

async function mirrorContainer(root, repository, session: Session) {
  log.info("discovering all resources in Pod ...")
  const all = await constructTree(root, session, [])
  log.info("Done discovering.")

  const res = await fetch(`${process.env.FUSEKI_ENDPOINT}/${repository}`, {method: "HEAD",}).then((r) => r.status);
  if (res !== 200) {
    await createRepository(repository)
    log.info(`Repository created: ${process.env.FUSEKI_ENDPOINT}/${repository}`)
  }

  log.info("mirroring RDF resources in Pod to SPARQL store ...")
  await uploadRdfToTripleStore(all, { overwrite: false }, repository, session);
  log.info("Done mirroring.")

  // if there are graphs in the SPARQL store that are not on the Pod anymore, purge them
  log.info("Purging non-existing files on SPARQL store...")
  const graphsInStore = await getAllGraphs();
  let toRemove = graphsInStore.filter((x) => !all.includes(x));
  for (const g of toRemove) {
    deleteResource(g, repository);
  }
  log.info("Done purging.")
  log.info("Done")
}

async function mirrorLBD(root, session: Session) {
  log.info(`Mirroring all resources in ${root}`)

  const myEngine = newEngine();
  const q = `SELECT ?proj WHERE {<${root}> <${LDP.contains}> ?proj}`;
  const projects = await myEngine
    .query(q, { sources: [root], fetch: session.fetch })
    .then((r: any) => r.bindings())
    .then((bind) => bind.map((item) => item.get("?proj").value));

  for (const project of projects) {
    const proj = new LbdProject(session.fetch, project);
    await proj.init();
    const subject = extract(proj.data, proj.localProject);
    const referenceRegistry = subject[LBD.hasReferenceRegistry][0]["@id"];
    const datasetRegistry = subject[LBD.hasDatasetRegistry][0]["@id"];

    const datasetTree = await constructTree(datasetRegistry, session, []);
    const datasets = datasetTree.filter((item) => item.endsWith("/"));
    const distributions = datasetTree.filter((item) => !item.endsWith("/"));
    const references = [referenceRegistry + "data.ttl"];

    const config = [
      { repo: proj.projectId + "_datasets", sources: datasets },
      { repo: proj.projectId + "_distributions", sources: distributions },
      { repo: proj.projectId + "_references", sources: references },
    ];

    for (const set of config) {
      const res = await fetch(`${process.env.FUSEKI_ENDPOINT}/${set.repo}`, {method: "HEAD",}).then((r) => r.status);
      if (res !== 200) {
        await createRepository(set.repo)
        log.info(`repository created: ${process.env.FUSEKI_ENDPOINT}/${set.repo}`)
      }
      await uploadRdfToTripleStore(
        set.sources,
        { overwrite: false },
        set.repo,
        session
      );
      const graphsInStore = await getAllGraphs(set.repo);
      let toRemove = graphsInStore.filter((x) => !set.sources.includes(x));
      for (const g of toRemove) {
        await deleteResource(g, set.repo);
      }      
    }

    log.info("Done mirroring.")

    for (const dist of distributions) {
      const distribution = new LbdDistribution(session.fetch, dist)
      const mime = await distribution.getContentType()
      if (mime.includes("text/turtle")) {
        const ds = dist.split("/")
        ds.pop()
        const dataset = ds.join("/") + "/"
        const q0 = `INSERT DATA {<${dist}> <${DCAT.accessURL}> <${process.env.LBD_SATELLITE}/${proj.projectId}_distributions/query?query=> .}`
        await proj.dataService.sparqlUpdate(dataset, q0)
      }
    }

    const q0 = `INSERT DATA {<${references[0]}> <${DCAT.accessURL}> <${process.env.LBD_SATELLITE}/${proj.projectId}_references/query?query=> .}`
    await proj.dataService.sparqlUpdate(referenceRegistry, q0)
  }
}

// create sockets to detect changes to resources in the Pod
async function openSockets(session) {
  const owner = session.info.webId;

  // get all resources (containers / resources) in the Pod
  // replace: expect webId and Pod to be on same server => good enough for now
  // const podRoot = owner.replace('profile/card#me', '')
  // log.info("discovering all resources in Pod ...")
  // const all = await constructTree(podRoot, session, [])
  // log.info("Done discovering.")

  // log.info("mirroring RDF resources in Pod to SPARQL store ...")
  // await uploadRdfToTripleStore(all, { overwrite: false }, session);
  // log.info("Done mirroring.")

  // // if there are graphs in the SPARQL store that are not on the Pod anymore, purge them
  // log.info("Purging non-existing files on SPARQL store...")
  // const graphsInStore = await getAllGraphs();
  // let toRemove = graphsInStore.filter((x) => !all.includes(x));
  // for (const g of toRemove) {
  //   deleteResource(g);
  // }
  // log.info("Done purging.")

  // create a socket that watches the pod
  // const idp_socket = await session
  //   .fetch(owner, { method: "HEAD" })
  //   .then((res) => res.headers.get("updates-via"));
  // const socket = new WebSocket(idp_socket, ["solid-0.1"]);

  // socket.onopen = function () {
  //   all.forEach((r) => {
  //     this.send(`sub ${r}`);
  //     log.info(`Completed WebSocket subscription to ${r}`)
  //   });
  // };

  // socket.onmessage = async function (msg) {
  //   if (msg.data && msg.data.slice(0, 3) === "pub") {

  //     // get the resource of interest
  //     const resource = msg.data.split([" "])[msg.data.split([" "]).length - 1];

  //     if (resource.endsWith("/")) { // the resource is an ldp:Container
  //       // the current resources in the Pod
  //       const newMembers = await getLDPcontent([resource], session);

  //       // the current resources in the SPARQL store
  //       let oldMembers = await querySparql(
  //         `SELECT ?item WHERE {?s <${LDP.contains}> ?item .}`,
  //         [resource]
  //       )
  //       oldMembers = oldMembers.results.bindings.map((b) => b.item.value);

  //       // there are resources in the Pod that are not yet in the SPARQL store => add to SPARQL store
  //       let toAdd = newMembers.filter((x) => !oldMembers.includes(x));
  //       await uploadRdfToTripleStore(toAdd, {}, session);

  //       // there are resources in the SPARQL store that are not in the Pod anymore => delete from SPARQL store
  //       let toRemove = oldMembers.filter((x) => !newMembers.includes(x));
  //       for (const g of toRemove) {
  //         deleteResource(g);
  //       }

  //     } else { // the resources is an ldp:Resource

  //       // only resources that can be served as JSON-LD may be used (i.e. only the RDF resources on the Pod)
  //       const data = await session
  //         .fetch(resource, { headers: { Accept: "application/ld+json" } })
  //         .then((res) => res.text());

  //       await uploadResource(data, resource, "jsonld");
  //     }
  //   }
  // };
}

export { openSockets, mirrorContainer, mirrorLBD};
