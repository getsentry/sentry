const CRLF_REGEXP = /[\r\n]/;

export default function containsCRLF(value: string) {
  return !!value.match(CRLF_REGEXP);
}
