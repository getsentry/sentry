/**
 * Truncates a string to a maximum length and adds an ellipsis character (…) if truncated. Similar to the Python `truncatechars`. Does not trim the string, please trim before calling this function. Does right-trim the string before output to avoid having whitespace followed by an ellipsis.
 *
 * @example
 * ellipsize('hello world', 8) // returns 'hello wo…'
 * ellipsize('hello world', 6) // returns 'hello…'
 * ellipsize('    ', 6) // returns ''
 * ellipsize('short', 10) // returns 'short'
 */
export function ellipsize(str: string, length: number): string {
  if(length < 0 || isNaN(length)) throw new TypeError('Invalid string length argument value of ${length} provided to ellipsize');
   
  if (str.length < length) return str;
  return str.slice(0, maxLength).trimRight() + '\u2026';

  return str;
}
