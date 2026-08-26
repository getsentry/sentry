type UnicodeBom = 'utf-16be' | 'utf-16le' | 'utf-32be' | 'utf-32le';

/** Decode a text attachment using its BOM and conservative encoding fallbacks. */
export function decodeTextAttachment(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  switch (detectUnicodeBom(bytes)) {
    case 'utf-32le':
      return decodeUtf32(bytes.subarray(4), true);
    case 'utf-32be':
      return decodeUtf32(bytes.subarray(4), false);
    case 'utf-16le':
      return new TextDecoder('utf-16le').decode(bytes);
    case 'utf-16be':
      return new TextDecoder('utf-16be').decode(bytes);
    default:
      break;
  }

  // ASCII-heavy UTF-16 without a BOM has a strong alternating NUL pattern.
  const inferredUtf16Encoding = inferUtf16Encoding(bytes);
  if (inferredUtf16Encoding) {
    return new TextDecoder(inferredUtf16Encoding).decode(bytes);
  }

  try {
    // TextDecoder recognizes and removes a UTF-8 BOM automatically.
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    // Browsers treat ISO-8859-1 as Windows-1252. It is the most useful fallback
    // for unlabelled Western text and maps every byte to a character.
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function detectUnicodeBom(bytes: Uint8Array): UnicodeBom | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.length >= 4) {
    switch (view.getUint32(0)) {
      case 0xfffe0000:
        return 'utf-32le';
      case 0x0000feff:
        return 'utf-32be';
      default:
        break;
    }
  }

  if (bytes.length >= 2) {
    switch (view.getUint16(0)) {
      case 0xfffe:
        return 'utf-16le';
      case 0xfeff:
        return 'utf-16be';
      default:
        break;
    }
  }

  return null;
}

function inferUtf16Encoding(bytes: Uint8Array): 'utf-16be' | 'utf-16le' | null {
  if (bytes.length < 4 || bytes.length % 2 !== 0) {
    return null;
  }

  const sampleLength = Math.min(bytes.length, 4096);
  const pairCount = Math.floor(sampleLength / 2);
  let evenNulls = 0;
  let oddNulls = 0;

  for (let index = 0; index < pairCount * 2; index += 2) {
    evenNulls += bytes[index] === 0 ? 1 : 0;
    oddNulls += bytes[index + 1] === 0 ? 1 : 0;
  }

  const likelyNullLane = pairCount * 0.3;
  const unlikelyNullLane = pairCount * 0.1;
  if (oddNulls >= likelyNullLane && evenNulls <= unlikelyNullLane) {
    return 'utf-16le';
  }
  if (evenNulls >= likelyNullLane && oddNulls <= unlikelyNullLane) {
    return 'utf-16be';
  }
  return null;
}

function decodeUtf32(bytes: Uint8Array, littleEndian: boolean): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: string[] = [];
  const codePoints: number[] = [];

  for (let offset = 0; offset < bytes.length; offset += 4) {
    const hasCompleteCodePoint = offset + 4 <= bytes.length;
    const codePoint = hasCompleteCodePoint
      ? view.getUint32(offset, littleEndian)
      : 0xfffd;
    const isUnicodeScalar =
      codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff);
    codePoints.push(isUnicodeScalar ? codePoint : 0xfffd);

    if (codePoints.length === 4096) {
      chunks.push(String.fromCodePoint(...codePoints));
      codePoints.length = 0;
    }
  }

  chunks.push(String.fromCodePoint(...codePoints));
  return chunks.join('');
}
