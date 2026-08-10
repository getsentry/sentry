import {
  type Mention,
  normalizeMentionInputValue,
  reconcileMentions,
} from 'sentry/components/mentionInput/model';

const MENTION: Mention = {
  id: 'user:1',
  sourceId: 'members',
  start: 6,
  end: 12,
  text: '@Alice',
};

describe('mention range model', () => {
  it('keeps a mention attached when text is inserted before it', () => {
    expect(reconcileMentions('Hello @Alice', 'Well, Hello @Alice', [MENTION])).toEqual([
      {...MENTION, start: 12, end: 18},
    ]);
  });

  it('drops mention metadata when its display text is edited', () => {
    expect(reconcileMentions('Hello @Alice', 'Hello @Alicia', [MENTION])).toEqual([]);
  });

  it('removes stale and overlapping restored mentions', () => {
    expect(
      normalizeMentionInputValue({
        text: 'Hello @Alice',
        mentions: [{...MENTION, text: '@Alicia'}, MENTION, {...MENTION, id: 'duplicate'}],
      })
    ).toEqual({text: 'Hello @Alice', mentions: [MENTION]});
  });
});
