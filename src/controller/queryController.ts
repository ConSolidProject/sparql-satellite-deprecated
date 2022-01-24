const { querySparql } = require('../functions/tripleStore')
const { discoverAcls, getAccessRightsAsk } = require('../functions//accessControl')
const { translate, toSparql } = require("sparqlalgebrajs");

async function queryPodUnion(req, res) {
  try {
    const actor = req.auth.webId
    const dataset = req.params.dataset
    const { query, graphVariable, from }: any = await validateQuery(req.query.query)
    const response = await querySparql(query, dataset)
    let bindings = []

    if (from) {
      const { acl } = await discoverAcls(from, req.session)
      if (actor) {
        for (const w of Object.keys(acl)) {
          const allowed = await getAccessRightsAsk(w, actor, ["http://www.w3.org/ns/auth/acl#Read"], req.session)
          if (!allowed) {
            throw new Error("You do not have access to one or more of the indicated named graphs")
          }
        }
      }
      bindings = response.results.bindings
    } else {
      const included = new Set(response.results.bindings.map(i => i[graphVariable].value))
      const { acl, public } = await discoverAcls(included, req.session)
      let allowedToQuery = public
      if (actor) {
        for (const w of Object.keys(acl)) {
          const allowed = await getAccessRightsAsk(w, actor, ["http://www.w3.org/ns/auth/acl#Read"], req.session)
          if (allowed) {
            allowedToQuery = [...allowedToQuery, ...acl[w]]
          }
        }
      }
      for (const binding of response.results.bindings) {
        const graph = binding[graphVariable].value
        if (allowedToQuery.includes(graph)) {
          bindings.push(binding)
        }
      }
    }

    res.status(200).send({ head: response.head, results: { bindings } })
  } catch (error) {
    console.log(`error`, error)
    res.status(400).send(error)
  }
}

// the query should include a query for a specific graph or a graph variable
function validateQuery(query) {
    const translation = translate(query, { quads: true });
    if (translation.type === "from") {
      let from
      if (translation.default.length > 0) from = translation.default.map(i => i.value)
      if (translation.named.length > 0 ) from = translation.named.map(i => i.value)
      return {query, from}
      // if (translation.default.length > 0) {
      //   resolve({ from: translation.default.map(i => i.value) })
      // }
      // if (translation.named.length > 0) {
      //   resolve({ from: translation.named.map(i => i.value) })
      // }
      // for (const pattern of translation.input.input.input.patterns) {
      //   if (!pattern.graph || pattern.graph.termType !== "Variable") {
      //     reject()
      //   }
      //   if (!translation.input.input.variables.contains(pattern.graph)) {
      //     reject()
      //   }
      //   for (const el of translation.input.input.variables) {
      //     if (el.termType === pattern.graph.termType && el.value === pattern.graph.value) {
      //       resolve({ graphVariable: pattern.graph.value })
      //     }
      //   }
      // }
      // reject()
    } else {
      const graphVariable = "source"
      const {bgp, variables} = findLowerLevel(translation, translation.variables)
      const graphVar = { termType: 'Variable', value: graphVariable }
      const theQ = {type: "project", input: {type: "graph", input: bgp, name: graphVar }, variables: [...variables, graphVar]}
      const newQuery = toSparql(theQ)
      return {query: newQuery, from: undefined, graphVariable}
    }

    function findLowerLevel(obj, variables?) {
      if (!variables) variables = obj.variables
      if (obj.type === "bgp") {
          return {bgp: obj, variables}
      } else {
          return findLowerLevel(obj.input, variables)
      }    
    }
  }
  

module.exports = { queryPodUnion }