import {decodeTextAttachment} from 'sentry/components/events/attachmentViewers/decodeTextAttachment';

describe('decodeTextAttachment', () => {
  it('decodes UTF-32 before its UTF-16LE BOM prefix', () => {
    const bytes = new Uint8Array([
      0xff,
      0xfe,
      0x00,
      0x00, // UTF-32LE BOM
      0x41,
      0x00,
      0x00,
      0x00, // A
      0xe6,
      0xf4,
      0x01,
      0x00, // 📦
    ]);

    expect(decodeTextAttachment(bytes.buffer)).toBe('A📦');
  });

  it('infers BOM-less UTF-16 from alternating null bytes', () => {
    const bytes = new Uint8Array([
      0x00,
      0x43, // C
      0x00,
      0x72, // r
      0x00,
      0x61, // a
      0x00,
      0x73, // s
      0x00,
      0x68, // h
    ]);

    expect(decodeTextAttachment(bytes.buffer)).toBe('Crash');
  });

  it('prefers valid UTF-8 over the legacy fallback', () => {
    const bytes = new Uint8Array([0x41, 0xe4, 0xb8, 0xad]);

    expect(decodeTextAttachment(bytes.buffer)).toBe('A中');
  });

  it('falls back to Windows-1252 for invalid UTF-8', () => {
    const bytes = new Uint8Array([0x63, 0x61, 0x66, 0xe9]);

    expect(decodeTextAttachment(bytes.buffer)).toBe('café');
  });
});
