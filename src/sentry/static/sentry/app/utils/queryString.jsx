// remove leading and trailing whitespace and remove double spaces
export function formatQueryString(qs) {
  return qs.trim().replace(/\s+/g, ' ');
}

// returns environment name from query or null if not specified
// Any charater can be valid in an environment name
export function getQueryEnvironment(qs) {
  const match = qs.match(/environment:([^\s]*)/);
  return match ? match[1] : null;
}

export function getQueryStringWithEnvironment(qs, env) {
  const qsWithoutEnv = qs.replace(/environment:[^\s]*/g, '');
  return formatQueryString(
    env === null ? qsWithoutEnv : `${qsWithoutEnv} environment:${env}`
  );
}

export function getQueryStringWithoutEnvironment(qs) {
  return formatQueryString(qs.replace(/environment:[^\s]*/g, ''));
}

export default {
  formatQueryString,
  getQueryEnvironment,
  getQueryStringWithEnvironment,
  getQueryStringWithoutEnvironment,
};
