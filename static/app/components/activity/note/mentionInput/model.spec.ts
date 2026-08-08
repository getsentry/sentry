import {
  type MentionValue,
  reconcileMentions,
  serializeMentions,
} from 'sentry/components/activity/note/mentionInput';

const MENTION: MentionValue = {
  id: 'user:1',
  sourceId: 'members',
  start: 6,
  end: 12,
  text: '@Alice',
  markup: '**@Alice**',
};

describe('mention document model', () => {
  it('keeps a token attached when text is inserted before it', () => {
    expect(reconcileMentions('Hello @Alice', 'Well, Hello @Alice', [MENTION])).toEqual([
      {...MENTION, start: 12, end: 18},
    ]);
  });

  it('turns a token back into plain text when its display text is edited', () => {
    expect(reconcileMentions('Hello @Alice', 'Hello @Alicia', [MENTION])).toEqual([]);
  });

  it('serializes the token without changing its surrounding text', () => {
    expect(serializeMentions('Hello @Alice!', [MENTION])).toBe('Hello **@Alice**!');
  });
});
