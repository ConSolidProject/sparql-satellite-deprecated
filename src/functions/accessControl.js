const newEngine = require('@comunica/actor-init-sparql').newEngine

// check if a person has the given access control modes associated with a specific acl file
async function getAccessRightsAsk(acl, requester, modes, session) {
    try {
      const myEngine = newEngine()
      const accessRights = [];
      for (const mode of modes) {
        let query = `
    PREFIX acl: <http://www.w3.org/ns/auth/acl#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
    
    ASK {?authorization
          a acl:Authorization ;
          acl:agent <${requester}> ;
          acl:mode <${mode}> .
    }`;
          const okay = await myEngine.query(query, { sources: [acl], fetch: session.fetch }).then(i => i.booleanResult)
          if (okay) accessRights.push(mode)
  
        // acl.results.bindings.forEach(b => {
        //   if ((b["agent"] && b["agent"].value === requester) || (b["agentClass"] && b["agentClass"].value === "http://xmlns.com/foaf/0.1/Agent")) {
        //     accessRights.push(b["rights"].value)
        //   } else if (b["agentGroup"]) {
        //     throw new Error('Agent groups are not implemented yet')
        //   }
        // })
      }
  
      function arraysEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.length !== b.length) return false;
    
        // If you don't care about the order of the elements inside
        // the array, you should sort both arrays here.
        // Please note that calling sort on an array will modify that array.
        // you might want to clone your array first.
    
        for (var i = 0; i < a.length; ++i) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      }
    
      if (arraysEqual(modes, accessRights)) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.log(`error`, error)
    }
}

// discover the ACLs (also fallback-ACLs) governing a set of resources. If public; that is immediately returned
async function discoverAcls(resources, session) {
    const existing = {}
    const public = []
  
    async function recursiveAcl(res, originalResource) {
      const result = await session.fetch(res + '.acl', { headers: { method: "HEAD" } });
  
      if (result.status == 200) {
        if (!existing[res + '.acl']) {
          existing[res + '.acl'] = [originalResource]
        } else {
          existing[res + '.acl'].push(originalResource)
        }
        return
      } else {
        const short = res.split('/')
        short.pop()
        if (res.endsWith("/")) {
          short.pop()
        }
        const fallbackAcl = short.join("/") + "/"
        await recursiveAcl(fallbackAcl, originalResource)
      }
    }
  
    for (const res of resources) {
      const p = await session.fetch(res, { headers: { method: "HEAD" } }).then(i => i.headers.get('wac-allow').split(','))
      if (p[p.length - 1].includes("public") && p[p.length - 1].includes("read")) {
        public.push(res)
      } else {
        await recursiveAcl(res, res)
      }
    }
    return { acl: existing, public }
}

module.exports = {getAccessRightsAsk, discoverAcls}