const CRLF_REGEXP = /[\n\r]/;

export default function containsCRLF(value: string) {
  return !!value.match(CRLF_REGEXP);
}
