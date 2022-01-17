# SPARQL satellite
This repository contains the work in progress towards a SPARQL mirror of a Solid Pod. This allows to query over the union of all the RDF resources in a Pod that the requesting agent is allowed to see. The only HTTP endpoint exposed is /query. 

The satellite should be kept closely to the Pod itself as it requires extensive access rights (e.g. to check ACL files of resources). A Solid Pod remains the primary access point for retrieving data. Using a specification such as DCAT, which describes Datasets (containing metadata) and Distributions (containing the actual resource content), we can indicate that a resource has a mirrored image on this SPARQL endpoint as well. If the user just wants a dump, they can just download it from the Pod directly. 

To allow a checking of access rights, we currently only support a subset of SPARQL queries, namely those which contain a direct reference to (1) the graphs that should be queried (FROM, FROM NAMED) or including a GRAPH variable (e.g.: ?g) in the query. 

A docker-compose.yml configuration is present, which directly spins up a Fuseki server along with the SPARQL satellite. Run `docker-compose up`. 