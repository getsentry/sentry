// returns environment name from query or null if not specified
function getQueryEnvironment(qs) {
  const match = qs.match(/environment:(\w*)/);
  return match ? match[1] : null;
}

function getQueryStringWithEnvironment(qs, env) {
  let qsWithoutEnv = qs.replace(/environment:\w+/g, '');
  return env === null ? qsWithoutEnv : qsWithoutEnv + ` environment:${env}`;
}

export default {
  getQueryEnvironment,
  getQueryStringWithEnvironment,
};
