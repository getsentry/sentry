import type {ConversationApiSpan} from 'sentry/views/explore/conversations/hooks/useConversation';

import {getConversationUserIdentity} from './conversationUser';

function span(overrides: Partial<ConversationApiSpan>): ConversationApiSpan {
  return {
    'gen_ai.conversation.id': 'conv-1',
    parent_span: '',
    'precise.finish_ts': 1,
    'precise.start_ts': 0,
    project: 'test-project',
    'project.id': 1,
    span_id: 'span-1',
    'span.name': 'chat',
    'span.status': 'ok',
    trace: 'trace-1',
    ...overrides,
  } as ConversationApiSpan;
}

function scrubbedMeta(attribute: string, ruleId = 'strip-fields', type = 's') {
  return {[attribute]: {meta: {value: {'': {len: 20, rem: [[ruleId, type]]}}}}};
}

describe('getConversationUserIdentity', () => {
  it('returns null when no span carries a user', () => {
    expect(getConversationUserIdentity([span({})])).toBeNull();
  });

  it('prefers email, then username, IP address and ID', () => {
    expect(
      getConversationUserIdentity([
        span({
          'user.id': '42',
          'user.username': 'jane',
          'user.email': 'jane@example.com',
        }),
      ])
    ).toEqual({field: 'user.email', value: 'jane@example.com', isScrubbed: false});
    expect(
      getConversationUserIdentity([span({'user.id': '42', 'user.ip': '127.0.0.1'})])
    ).toEqual({field: 'user.ip', value: '127.0.0.1', isScrubbed: false});
  });

  it('skips empty and "none" values', () => {
    expect(
      getConversationUserIdentity([span({'user.email': '', 'user.username': 'None'})])
    ).toBeNull();
  });

  it('falls through a scrubbed value to a real one', () => {
    expect(
      getConversationUserIdentity([
        span({
          'user.email': '[Filtered]',
          'user.id': '42',
          meta: scrubbedMeta('user.email'),
        }),
      ])
    ).toEqual({field: 'user.id', value: '42', isScrubbed: false});
  });

  it('treats scrubbing that leaves no "[Filtered]" mark as scrubbed', () => {
    expect(
      getConversationUserIdentity([
        span({
          'user.email': '[email]',
          'user.username': 'jane',
          meta: scrubbedMeta('user.email', '@email:replace'),
        }),
      ])
    ).toEqual({field: 'user.username', value: 'jane', isScrubbed: false});
  });

  it('treats "[Filtered]" as scrubbed without meta', () => {
    expect(
      getConversationUserIdentity([span({'user.email': '[Filtered]', 'user.id': '42'})])
    ).toEqual({field: 'user.id', value: '42', isScrubbed: false});
  });

  it('prefers a real value on a later span over a scrubbed one', () => {
    expect(
      getConversationUserIdentity([
        span({'user.email': '[Filtered]', meta: scrubbedMeta('user.email')}),
        span({span_id: 'span-2', 'user.username': 'jane'}),
      ])
    ).toEqual({field: 'user.username', value: 'jane', isScrubbed: false});
  });

  it('returns the first scrubbed value, with its rule, when every value is scrubbed', () => {
    expect(
      getConversationUserIdentity([
        span({
          'user.email': '[Filtered]',
          'user.id': '[Filtered]',
          meta: {...scrubbedMeta('user.email'), ...scrubbedMeta('user.id')},
        }),
      ])
    ).toEqual({
      field: 'user.email',
      value: '[Filtered]',
      isScrubbed: true,
      scrubbingRule: {ruleId: 'strip-fields', remark: 's', projectSlug: 'test-project'},
    });
  });
});
