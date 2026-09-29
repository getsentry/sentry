import {broadcastValidationSchema, getBroadcastSchema} from './broadcasts';

const validBroadcast = {
  title: 'New feature',
  message: 'A short description',
  link: 'https://example.com',
  mediaUrl: '',
};

describe('broadcast creation validation', () => {
  it.each([
    ['title', 'x'.repeat(65)],
    ['message', 'x'.repeat(257)],
    ['link', 'invalid'],
    ['mediaUrl', 'invalid'],
  ] as const)('rejects an invalid %s', (field, value) => {
    const result = broadcastValidationSchema.safeParse({
      ...validBroadcast,
      [field]: value,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual([field]);
    }
  });

  it('accepts the displayed character limits and an empty image URL', () => {
    const fields = getBroadcastSchema();
    const titleLimit = fields.find(field => field.name === 'title');
    const messageLimit = fields.find(field => field.name === 'message');

    expect(titleLimit?.type === 'string' && titleLimit.maxLength).toBe(64);
    expect(messageLimit?.type === 'string' && messageLimit.maxLength).toBe(256);
    expect(
      broadcastValidationSchema.safeParse({
        ...validBroadcast,
        title: 'x'.repeat(64),
        message: 'x'.repeat(256),
      }).success
    ).toBe(true);
  });
});
