// remove leading and trailing whitespace and remove double spaces
function formatQueryString(qs) {
  return qs.trim().replace(/\s+/g, ' ');
}

// returns environment name from query or null if not specified
// Any charater can be valid in an environment name
function getQueryEnvironment(qs) {
  const match = qs.match(/environment:([^\s]*)/);
  return match ? match[1] : null;
}

function getQueryStringWithEnvironment(qs, env) {
  const qsWithoutEnv = qs.replace(/environment:[^\s]*/g, '');
  return formatQueryString(
    env === null ? qsWithoutEnv : qsWithoutEnv + ` environment:${env}`
  );
}

export default {
  formatQueryString,
  getQueryEnvironment,
  getQueryStringWithEnvironment,
};
