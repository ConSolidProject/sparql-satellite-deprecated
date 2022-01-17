var { SolidNodeClient } = require("solid-node-client");
const {uploadRdfToTripleStore, getAllGraphs, deleteResource, querySparql, uploadResource} = require('./tripleStore')
const {getLDPcontent} = require('./auxiliaries')
const { log } = require('../util/logger');
const WebSocket = require('ws')

// construct the resources in the Pod in a recursive way
async function constructTree(root, session, recursiveArray) {
    const resources = await getLDPcontent([root], session)
    for (const res of resources) {
      recursiveArray.push(res)
      if (res.endsWith('/')) {
        recursiveArray = await constructTree(res, session, recursiveArray)
      }
    }
    return recursiveArray
}

// create sockets to detect changes to resources in the Pod
async function openSockets() {
    const client = new SolidNodeClient();
    const session = await client.login(JSON.parse(process.env.CREDS));
    const owner = session.info.webId;
  
    // get all resources (containers / resources) in the Pod
    // replace: expect webId and Pod to be on same server => good enough for now
    const podRoot = owner.replace('profile/card#me', '')
    log.info("discovering all resources in Pod ...")
    const all = await constructTree(podRoot, session, [])
    log.info("Done discovering.")
  
    log.info("mirroring RDF resources in Pod to SPARQL store ...")
    await uploadRdfToTripleStore(all, { overwrite: false }, session);
    log.info("Done mirroring.")
  
    // if there are graphs in the SPARQL store that are not on the Pod anymore, purge them
    log.info("Purging non-existing files on SPARQL store...")
    const graphsInStore = await getAllGraphs();
    let toRemove = graphsInStore.filter((x) => !all.includes(x));
    for (const g of toRemove) {
      deleteResource(g);
    }
    log.info("Done purging.")
  
    // create a socket that watches the pod
    const idp_socket = await session
      .fetch(owner, { method: "HEAD" })
      .then((res) => res.headers.get("updates-via"));
    const socket = new WebSocket(idp_socket, ["solid-0.1"]);
  
    socket.onopen = function () {
      all.forEach((r) => {
        this.send(`sub ${r}`);
        log.info(`Completed WebSocket subscription to ${r}`)
      });
    };
  
    socket.onmessage = async function (msg) {
      if (msg.data && msg.data.slice(0, 3) === "pub") {
  
        // get the resource of interest
        const resource = msg.data.split([" "])[msg.data.split([" "]).length - 1];
  
  
        if (resource.endsWith("/")) { // the resource is an ldp:Container
          // the current resources in the Pod
          const newMembers = await getLDPcontent([resource], session);
  
          // the current resources in the SPARQL store
          let oldMembers = await querySparql(
            prefixes + `SELECT ?item WHERE {?s ldp:contains ?item .}`,
            [resource]
          )
          oldMembers = oldMembers.results.bindings.map((b) => b.item.value);
  
  
          // there are resources in the Pod that are not yet in the SPARQL store => add to SPARQL store
          let toAdd = newMembers.filter((x) => !oldMembers.includes(x));
          await uploadRdfToTripleStore(difference, {}, session);
  
          // there are resources in the SPARQL store that are not in the Pod anymore => delete from SPARQL store
          let toRemove = oldMembers.filter((x) => !newMembers.includes(x));
          for (const g of toRemove) {
            deleteResource(g);
          }
  
        } else { // the resources is an ldp:Resource
  
          // only resources that can be served as JSON-LD may be used (i.e. only the RDF resources on the Pod)
          const data = await session
            .fetch(resource, { headers: { Accept: "application/ld+json" } })
            .then((res) => res.text());
  
          await uploadResource(data, resource, "jsonld");
        }
      }
    };
}

module.exports = {openSockets}