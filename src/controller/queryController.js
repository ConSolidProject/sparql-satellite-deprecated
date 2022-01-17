const {querySparql} = require('../functions/tripleStore')
const {discoverAcls, getAccessRightsAsk} = require('../functions//accessControl')
const { translate } = require("sparqlalgebrajs");

async function queryPodUnion(req, res) {
    try {
      const actor = req.auth.webId
      const { query } = req.query
  
      // it MUST be a query with the graph parameter ?g, because we need to check if the results can be returned
      const { graphVariable, from } = await validateQuery(query)
      const response = await querySparql(query)
      const included = response.results.bindings.map(i => i[graphVariable].value)
      const { acl, public } = await discoverAcls(included, req.session)
      const bindings = []
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
        res.send({head: response.head, results: {bindings}})
  
      //  if (from) {
      //   for (const graph of from) {
  
      //     // false function! should check for visitor (no time now)
      //     const rights = await req.session.fetch(graph, {method: "HEAD"}).then(res => res.headers.get('wac-allow'))
      //     if (!rights.includes("read")) {
      //       res.status(400).send("You don't have READ access rights to all the graphs you wanted to query. Please check the 'FROM NAMED' statements in your query")
      //     }
      //   }
  
      //   res.send(response)
  
      //  } else {
      //   for (const binding of response.results.bindings) {
      //     const graph = binding[graphVariable].value
      //     await findAcl(graph, req.session)
  
  
      //     if (allowedToQuery.includes(binding[graphVariable].value)) {
      //       bindings.push(binding)
      //     } else {
      //      // false function! should check for visitor (no time now)
      //      const rights = await req.session.fetch(binding[graphVariable].value, {method: "HEAD"}).then(res => res.headers.get('wac-allow'))
      //      if (rights.includes("read")) {
      //       bindings.push(binding)
      //       allowedToQuery.push(binding[graphVariable].value)
      //      }
      //     }
      //   }
      //   res.send({head: response.head, results: {bindings}})
      //  }
    } catch (error) {
      console.log(`error`, error)
      res.status(400).send(error)
    }
  }

// the query should include a query for a specific graph or a graph variable
function validateQuery(query) {
    return new Promise((resolve, reject) => {
      let translation
      try {
        translation = translate(query, { quads: true });
      } catch (error) {
        try {
          query = decodeURI(query)
          query = query.replace("%23", "#"); //you'll have to replace hash (replaceAll does not work here?)
          translation = translate(query)
        } catch (e) {
          reject(e)
        }
      }
      if (translation.type === "project") {
        for (const pattern of translation.input.patterns) {
          if (!pattern.graph || pattern.graph.termType !== "Variable") {
            reject()
          }
          for (const el of translation.variables) {
            if (el.termType === pattern.graph.termType && el.value === pattern.graph.value) {
              resolve({ graphVariable: pattern.graph.value })
            }
          }
        }
        reject()
      } else if (translation.type === "slice") {
        for (const pattern of translation.input.input.patterns) {
          if (!pattern.graph || pattern.graph.termType !== "Variable") {
            reject(pattern.graph.value)
          }
          for (const el of translation.input.variables) {
            if (el.termType === pattern.graph.termType && el.value === pattern.graph.value) {
              resolve({ graphVariable: pattern.graph.value })
            }
          }
        }
        reject()
      } else if (translation.type = "from") {
        if (translation.default.length > 0) {
          resolve({ from: translation.default.map(i => i.value) })
        }
        if (translation.named.length > 0) {
          resolve({ from: translation.named.map(i => i.value) })
        }
        for (const pattern of translation.input.input.input.patterns) {
          if (!pattern.graph || pattern.graph.termType !== "Variable") {
            reject()
          }
          if (!translation.input.input.variables.contains(pattern.graph)) {
            reject()
          }
          for (const el of translation.input.input.variables) {
            if (el.termType === pattern.graph.termType && el.value === pattern.graph.value) {
              resolve({ graphVariable: pattern.graph.value })
            }
          }
        }
        reject()
      }
    }
    )
  }

  module.exports = {queryPodUnion}