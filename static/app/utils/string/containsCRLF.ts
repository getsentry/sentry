const CRLF_REGEXP = /[\r\n]/;

export function containsCRLF(value: string) {
  return !!value.match(CRLF_REGEXP);
}
