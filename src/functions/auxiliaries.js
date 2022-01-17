const newEngine = require('@comunica/actor-init-sparql').newEngine
const {LDP} = require('../vocab')

// get the content (ldp:contains) of an ldp:Container instance
async function getLDPcontent(sources, session) {
    const myEngine = newEngine()
    const q = `SELECT ?item WHERE {
      ?s <${LDP.contains}> ?item . }`;
    return await myEngine.query(q, { sources, fetch: session.fetch }).then(b => b.bindings()).then(r => r.map(item => item.get('?item').value))

}

module.exports = {getLDPcontent}