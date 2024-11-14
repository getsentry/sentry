export type CursorInfo = {
  isPrev: boolean;
  offset: number;
  value: number;
};

/// Converts a cursor string into a Cursor object.
export function parseCursor(
  cursor: string | string[] | undefined | null
): CursorInfo | undefined {
  if (!cursor) {
    return undefined;
  }
  if (Array.isArray(cursor)) {
    if (cursor.length > 0) {
      cursor = cursor[0];
    } else {
      return undefined;
    }
  }
  const bits = cursor.split(':');

  if (bits.length !== 3) {
    return undefined;
  }

  try {
    const value = parseInt(bits[0], 10);
    const offset = parseInt(bits[1], 10);
    const isPrev = bits[2] === '1';
    return {isPrev, offset, value};
  } catch (e) {
    return undefined;
  }
}
