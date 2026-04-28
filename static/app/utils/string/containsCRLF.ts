const CRLF_REGEXP = /[\r\n]/;

export function containsCRLF(value: string) {
  return !!CRLF_REGEXP.test(value);
}
