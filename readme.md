# SPARQL satellite
This repository contains the work in progress towards a SPARQL mirror of a Solid Pod. This allows to query over the union of all the RDF resources in a Pod that the requesting agent is allowed to see. The only HTTP endpoint exposed is /query. 

The satellite should be kept closely to the Pod itself as it requires extensive access rights (e.g. to check ACL files of resources). A Solid Pod remains the primary access point for retrieving data. Using a specification such as DCAT, which describes Datasets (containing metadata) and Distributions (containing the actual resource content), we can indicate that a resource has a mirrored image on this SPARQL endpoint as well. If the user just wants a dump, they can just download it from the Pod directly. 

To allow a checking of access rights, we currently only support a subset of SPARQL queries, namely those which contain a direct reference to (1) the graphs that should be queried (FROM, FROM NAMED) or (2) including a GRAPH variable (e.g.: ?g) in the query if the entire Pod is to be queried. 

A docker-compose.yml configuration is present, which directly spins up a Fuseki server along with the SPARQL satellite. Run `docker-compose up`. The Solid Server is to be started separately (TBD: include in Docker Compose). 

The configuration makes use of environment variables. A template is provided as .env.template. Note the following: 
* The satellite needs to be able to authenticate to the Pod. Therefore, the configuration should contain the resulting JSON object of the action  `npx @inrupt/generate-oidc-token`. This token will be of the form `CREDS={  "refreshToken" : "theRefreshToken",  "clientId"     : "theClientId",  "clientSecret" : "theClientSecret",  "oidcIssuer"   : "http://localhost:5000/"}`
* To enable (1) the mirroring of resources at startup of the satellite and (2) remaining in sync with the changes on the Pod, it is necessary that the environment variable `SOCKETS_ACTIVE` is set to true. 
* The SPARQL endpoint (Fuseki) needs to be protected as well; the environment variables contain the credentials for an admin. 