// "unit separator" character to delimit values and avoid conflicts with string values
// https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text
const DELIMITER = String.fromCharCode(31);

export function createDelimiter(delimiter = DELIMITER) {
  function join(...strings: (string | undefined | unknown)[]) {
    return strings.filter(v => Boolean(v)).join(delimiter);
  }
  function split(str: string) {
    return str.split(delimiter);
  }

  return {
    join,
    split,
  };
}
