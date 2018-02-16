// remove leading and trailing whitespace and remove double spaces
function formatQueryString(qs) {
  return qs.trim().replace(/\s+/g, ' ');
}

// returns environment name from query or null if not specified
function getQueryEnvironment(qs) {
  const match = qs.match(/environment:(\w*)/);
  return match ? match[1] : null;
}

function getQueryStringWithEnvironment(qs, env) {
  const qsWithoutEnv = qs.replace(/environment:\w+/g, '');
  return formatQueryString(
    env === null ? qsWithoutEnv : qsWithoutEnv + ` environment:${env}`
  );
}

export default {
  formatQueryString,
  getQueryEnvironment,
  getQueryStringWithEnvironment,
};
