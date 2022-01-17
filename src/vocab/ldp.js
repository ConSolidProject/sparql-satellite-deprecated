const _NAMESPACE = "http://www.w3.org/ns/ldp#";
function _NS (localName) {
  return (_NAMESPACE + localName);
}

const LDP = {
  PREFIX: "ldp",
  NAMESPACE: _NAMESPACE,
  PREFIX_AND_NAMESPACE: { "ldp": _NAMESPACE },
  NS: _NS,

  contains: _NS("contains"),
}

module.exports = {LDP}