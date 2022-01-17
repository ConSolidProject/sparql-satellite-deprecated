const express = require('express');
const cors = require('cors')
const { setSatellite, extractWebId } = require('express-solid-auth-wrapper')
const { log } = require('./util/logger');
const { queryPodUnion } = require('./controller/queryController')
const {openSockets} = require('./functions/socket')
const port = process.env.PORT_LBD

const app = express();
app.use(cors())
app.use(express.json());

// // set satellite authenticated session as req.session
const creds = JSON.parse(process.env.CREDS) // CREDS generated via `npx @inrupt/generate-oidc-token`
app.use(setSatellite(creds))

// extract client webId, if exists: req.auth.webId (req.auth.clientId)
app.use(extractWebId)

// configure route to query the union of the graphs in the Pod, via an access-controlled Fuseki SPARQL store
app.get('/query', queryPodUnion)

app.listen(port, async () => {
    log.info(`Server listening at http://localhost:${port}`);

    // sync the POD with the SPARQL store
    if (process.env.SOCKETS_ACTIVE === "true") {
        openSockets()
    }
})
