const UTF16LE_BOM = [0xff, 0xfe] as const;
const UTF16BE_BOM = [0xfe, 0xff] as const;
const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) {
    return false;
  }
  return prefix.every((value, index) => bytes[index] === value);
}

/**
 * Detect a Unicode encoding from a leading BOM.
 */
export function encodingFromBom(bytes: Uint8Array): string | null {
  if (hasPrefix(bytes, UTF16LE_BOM)) {
    return 'utf-16le';
  }
  if (hasPrefix(bytes, UTF16BE_BOM)) {
    return 'utf-16be';
  }
  if (hasPrefix(bytes, UTF8_BOM)) {
    return 'utf-8';
  }
  return null;
}

function bomLength(encoding: string): number {
  if (encoding === 'utf-16le' || encoding === 'utf-16be') {
    return 2;
  }
  if (encoding === 'utf-8') {
    return 3;
  }
  return 0;
}

export function decodeAttachmentText(bytes: Uint8Array): string {
  const encoding = encodingFromBom(bytes);
  if (!encoding) {
    return new TextDecoder('utf-8').decode(bytes);
  }
  return new TextDecoder(encoding).decode(bytes.subarray(bomLength(encoding)));
}

/**
 * Decode preview payload from the API client.
 * Production fetches use ArrayBuffer (raw bytes). Tests often mock a UTF-8 string.
 */
export function decodeAttachmentPreview(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return decodeAttachmentText(new Uint8Array(data));
  }
  if (ArrayBuffer.isView(data)) {
    return decodeAttachmentText(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    );
  }
  return '';
}
