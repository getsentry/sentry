var getQueryParams = function() {
  var vars = {},
      href = window.location.href,
      hashes, hash;

  if (href.indexOf('?') == -1)
    return vars;

  hashes = href.slice(
    href.indexOf('?') + 1,
    (href.indexOf('#') != -1 ? href.indexOf('#') : href.length)
  ).split('&');
  for (var i = 0, chunk; (chunk = hashes[i]); i++) {
    hash = chunk.split('=');
    if (!hash[0] && !hash[1]) {
      return;
    }

    vars[decodeURIComponent(hash[0])] = (hash[1] ? decodeURIComponent(hash[1]).replace(/\+/, ' ') : '');
  }

  return vars;
};

module.exports = {
  getQueryParams: getQueryParams
};
