import {getConversationDisplayId} from './conversationDisplayId';

describe('getConversationDisplayId', () => {
  it('truncates UUIDs to their first 8 characters', () => {
    expect(getConversationDisplayId('7b1c8f2e-4d3a-4b5c-9e6f-0a1b2c3d4e5f')).toBe(
      '7b1c8f2e'
    );
  });

  it('returns non-UUID ids unchanged', () => {
    expect(getConversationDisplayId('resp_abc123')).toBe('resp_abc123');
    expect(getConversationDisplayId('slack:C0123:1791343083.972129')).toBe(
      'slack:C0123:1791343083.972129'
    );
  });
});
