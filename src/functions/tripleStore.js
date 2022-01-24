const FormData = require('form-data')
const {v4} = require('uuid')

// get all graphs available in the SPARQL store
async function getAllGraphs(dataset) {
    const graphsInStore = await querySparql(
        `SELECT DISTINCT ?g WHERE {GRAPH ?g {?s ?p ?o}}`,
        dataset
    );
    return graphsInStore.results.bindings.map((b) => b.g.value);
}

// delete a resource in the SPARQL store
async function deleteResource(resource, dataset) {
    const query = `CLEAR GRAPH <${resource}>`;
    await updateSparql(query, dataset);
}

// upload a resource to the SPARQL store
async function uploadResource(data, graph, dataset, extension) {
    var myHeaders = new Headers();
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Connection", "keep-alive");

    var formdata = new FormData();
    if (data.buffer) {
        formdata.append("file", data.buffer, data.originalname);
    } else {
        formdata.append(
            "file",
            Buffer.from(JSON.stringify(data)),
            `${v4()}.${extension}`
        );
    }
    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: formdata,
        redirect: "follow",
    };

    let url = process.env.FUSEKI_ENDPOINT + "/" + dataset;
    if (graph) url = url + `?graph=${graph}`;

    try {
        const response = await fetch(url, requestOptions);
        return response.status;
    } catch (error) {
        console.log(`error`, error);
    }
    return;
}

// send a SPARQL update to the SPARQL store
async function updateSparql(query, dataset) {
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
    myHeaders.append(
        "Authorization",
        "Basic " +
        Buffer.from(process.env.FUSEKI_UN + ":" + process.env.FUSEKI_PW).toString(
            "Base64"
        )
    );

    var urlencoded = new URLSearchParams();
    urlencoded.append("update", query);

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: urlencoded,
        redirect: "follow",
    };

    let response = await fetch(
        process.env.FUSEKI_ENDPOINT + "/" + dataset,
        requestOptions
    );
    response = await response.text();
    return response;
}

// upload a list of resources, filter RDF resources, check if they already exist on the triple store and if not, upload to the SPARQL store
async function uploadRdfToTripleStore(sync, options, dataset, session) {
    try {
        for (const resource of sync) {
            let exists;
            if (!options.overwrite) {
                exists = await checkExistenceInTripleStore(resource, dataset);
            }
            if (options.overwrite || !exists) {
                const data = await session.fetch(resource, {
                    headers: { Accept: "application/ld+json" },
                });
                // content types to sync
                if (data.status === 200) {
                    await deleteResource(resource);
                    const text = await data.json();
                    await uploadResource(text, resource, dataset, "jsonld");
                }
            }
        }
    } catch (error) {
        console.log(`error`, error);
    }
}

// check the existence of a named graph in the SPARQL store
async function checkExistenceInTripleStore(named, dataset) {
    const result = await querySparql(
        `ASK WHERE { GRAPH <${named}> { ?s ?p ?o } }`,
        dataset
    );
    return result.boolean;
}

// perform a SPARQL query on the SPARQL store
async function querySparql(query, dataset) {
    var myHeaders = new Headers();
    myHeaders.append("Accept", "application/sparql-results+json");
    myHeaders.append(
        "Authorization",
        "Basic " +
        Buffer.from(process.env.FUSEKI_UN + ":" + process.env.FUSEKI_PW).toString(
            "Base64"
        )
    );

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        redirect: "follow",
    };

    let url =
        process.env.FUSEKI_ENDPOINT + "/" +
        dataset +
        "?query=" +
        encodeURI(query);
    url = url.replace(/#/g, "%23"); //you'll have to replace hash (replaceAll does not work here?)
    try {
        const res = await fetch(url, requestOptions);
        if (res.status === 200) {
            const results = await res.json();
            return results;
        } else {
            return { results: { bindings: [] } }
        }
    } catch (error) {
        console.log(`error`, error)
        return { results: { bindings: [] } }
    }
}

async function createRepository(name) {
    var myHeaders = new Headers();
    myHeaders.append("Cookie", `JSESSIONID=${process.env.FUSEKI_SESSION}`);
    
    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      redirect: 'follow'
    };
    
    fetch(`${process.env.FUSEKI_ENDPOINT}/$/datasets?dbName=${name}&dbType=tdb2`, requestOptions)
      .then(response => response.text())
      .then(result => console.log(result))
      .catch(error => console.log('error', error));

    return
}

module.exports = {querySparql, checkExistenceInTripleStore, uploadRdfToTripleStore, updateSparql, uploadResource, deleteResource, getAllGraphs, createRepository}