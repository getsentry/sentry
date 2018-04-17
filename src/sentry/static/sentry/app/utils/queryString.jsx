// remove leading and trailing whitespace and remove double spaces
export function formatQueryString(qs) {
  return qs.trim().replace(/\s+/g, ' ');
}

// returns environment name from query or null if not specified
// Any character can be valid in an environment name but we need to
// check for matching environments with the quotation marks first
// to match the way tag searches are being done
export function getQueryEnvironment(qs) {
  // A match with quotes will lazily match any characters within quotation marks
  const matchWithQuotes = qs.match(/(?:^|\s)environment:"(.*?)"/);
  // A match without quotes will match any non space character
  const matchWithoutQuotes = qs.match(/(?:^|\s)environment:([^\s]*)/);

  if (matchWithQuotes) {
    return matchWithQuotes[1];
  } else if (matchWithoutQuotes) {
    return matchWithoutQuotes[1];
  } else {
    return null;
  }
}

export function getQueryStringWithEnvironment(qs, env) {
  const qsWithoutEnv = qs.replace(/(?:^|\s)environment:[^\s]*/g, '');
  return formatQueryString(
    env === null ? qsWithoutEnv : `${qsWithoutEnv} environment:${env}`
  );
}

export function getQueryStringWithoutEnvironment(qs) {
  return formatQueryString(qs.replace(/(?:^|\s)environment:[^\s]*/g, ''));
}

export default {
  formatQueryString,
  getQueryEnvironment,
  getQueryStringWithEnvironment,
  getQueryStringWithoutEnvironment,
};
