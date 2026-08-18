import {
  decodeAttachmentPreview,
  decodeAttachmentText,
} from 'sentry/components/events/attachmentViewers/decodeAttachmentText';

describe('decodeAttachmentText', () => {
  it('decodes UTF-16LE with BOM including Chinese', () => {
    const text = '时间: UTF-16 附件';
    const payload = new Uint8Array([0xff, 0xfe, ...utf16leBytes(text)]);

    expect(decodeAttachmentText(payload)).toBe(text);
  });

  it('falls back to UTF-8 when BOM is missing', () => {
    expect(decodeAttachmentText(new TextEncoder().encode('中文 hello'))).toBe(
      '中文 hello'
    );
  });
});

describe('decodeAttachmentPreview', () => {
  it('returns mocked string payloads unchanged', () => {
    expect(decodeAttachmentPreview('file contents')).toBe('file contents');
  });

  it('decodes ArrayBuffer UTF-16LE payloads', () => {
    const text = '时间: UTF-16 附件';
    const bytes = new Uint8Array([0xff, 0xfe, ...utf16leBytes(text)]);
    expect(decodeAttachmentPreview(bytes.buffer)).toBe(text);
  });
});

function utf16leBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes.push(code & 0xff, code >> 8);
  }
  return bytes;
}
