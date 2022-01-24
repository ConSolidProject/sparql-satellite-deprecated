import {Session} from '@inrupt/solid-client-authn-node'
import { LBDserver } from 'lbdserver-client-api';
import { IQueryResultBindings, newEngine } from '@comunica/actor-init-sparql';

import {mirrorLBD, openSockets, mirrorContainer} from "./functions/sync"

const { LbdService } = LBDserver;

const express = require('express');
const cors = require('cors')
const { setSatellite, extractWebId } = require('express-solid-auth-wrapper')
const { log } = require('./util/logger');
const { queryPodUnion } = require('./controller/queryController')
const sessions = require('express-session')
const port = process.env.PORT_LBD

const app = express();
app.use(cors())
app.use(express.json());

// // set satellite authenticated session as req.session
const creds = JSON.parse(process.env.CREDS) // CREDS generated via `npx @inrupt/generate-oidc-token`
app.use(setSatellite(creds))
const oneDay = 1000 * 60 * 60 * 24;

// extract client webId, if exists: req.auth.webId (req.auth.clientId)
app.use(extractWebId)

// configure route to query the union of the graphs in the Pod, via an access-controlled Fuseki SPARQL store
app.get('/:dataset/query', queryPodUnion)

app.listen(port, async () => {
    log.info(`Server listening at http://localhost:${port}`);

    const session = new Session()
    await session.login(JSON.parse(process.env.CREDS));

    if (process.env.MIRROR_ACTIVE === "true") {
        // const lbd = new LbdService(session.fetch);
        // const root = await lbd.getProjectRegistry(session.info.webId);
        // await mirrorLBD(root, session)

        const root = session.info.webId.replace("/profile/card#me", "/")
        await mirrorContainer(root, "dataset", session)
    }

    // open sockets to resources on the Pod
    // if (process.env.SOCKETS_ACTIVE === "true") {
    //     log.info("opening sockets ...")
    //     openSockets(session)
    //     log.info("done opening sockets ...")
    // }
})
