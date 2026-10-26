import {
  applyTextEdit,
  getAtomicDeletionRange,
  getValidMentions,
  locateEdit,
  type Mention,
  snapOffset,
} from './model';

const TEXT = 'Hello @Alice today';
const MENTION: Mention = {
  id: 'user:1',
  sourceId: 'members',
  start: 6,
  end: 12,
  text: '@Alice',
};
const VALUE = {text: TEXT, mentions: [MENTION]};

describe('getValidMentions', () => {
  it('sorts mentions and drops ranges that no longer match their text', () => {
    const team: Mention = {
      id: 'team:1',
      sourceId: 'teams',
      start: 0,
      end: 5,
      text: 'Hello',
    };
    expect(
      getValidMentions({
        text: TEXT,
        mentions: [MENTION, team, {...MENTION, id: 'stale', start: 7, end: 13}],
      })
    ).toEqual([team, MENTION]);
  });

  it('drops a mention that overlaps an earlier one', () => {
    expect(
      getValidMentions({
        text: TEXT,
        mentions: [
          MENTION,
          {...MENTION, id: 'overlap', start: 7, end: 12, text: 'Alice'},
        ],
      })
    ).toEqual([MENTION]);
  });
});

describe('locateEdit', () => {
  it('locates a character typed between two identical characters', () => {
    // A plain diff would place the new "l" after the existing ones.
    expect(locateEdit('hello', 'helllo', {start: 2, end: 2}, 3)).toEqual({
      start: 2,
      end: 2,
      text: 'l',
    });
  });

  it('locates Backspace, forward Delete, and replacing a selection', () => {
    expect(locateEdit('aaa', 'aa', {start: 1, end: 1}, 0)).toEqual({
      start: 0,
      end: 1,
      text: '',
    });
    expect(locateEdit('aaa', 'aa', {start: 1, end: 1}, 1)).toEqual({
      start: 1,
      end: 2,
      text: '',
    });
    expect(locateEdit('one two', 'one 2', {start: 4, end: 7}, 5)).toEqual({
      start: 4,
      end: 7,
      text: '2',
    });
  });

  it('falls back to a text diff when the selection does not explain the edit', () => {
    expect(locateEdit('abc', 'xbc', {start: 3, end: 3}, 3)).toEqual({
      start: 0,
      end: 1,
      text: 'x',
    });
  });
});

describe('applyTextEdit', () => {
  it('moves mentions after an edit and keeps those before it', () => {
    expect(applyTextEdit(VALUE, {start: 0, end: 0, text: 'Well, '})).toEqual({
      caret: 6,
      value: {
        text: 'Well, Hello @Alice today',
        mentions: [{...MENTION, start: 12, end: 18}],
      },
    });
    expect(applyTextEdit(VALUE, {start: 12, end: 12, text: '!'}).value.mentions).toEqual([
      MENTION,
    ]);
  });

  it('removes a whole mention when a deletion touches part of it', () => {
    expect(applyTextEdit(VALUE, {start: 11, end: 12, text: ''})).toEqual({
      caret: 6,
      value: {text: 'Hello  today', mentions: []},
    });
    expect(applyTextEdit(VALUE, {start: 3, end: 8, text: 'p'})).toEqual({
      caret: 4,
      value: {text: 'Help today', mentions: []},
    });
  });

  it('turns a mention into text when text is inserted inside it', () => {
    expect(applyTextEdit(VALUE, {start: 9, end: 9, text: 'x'}).value).toEqual({
      text: 'Hello @Alxice today',
      mentions: [],
    });
  });

  it('keeps the exact text while an input method is composing', () => {
    expect(applyTextEdit(VALUE, {start: 11, end: 12, text: ''}, {atomic: false})).toEqual(
      {caret: 11, value: {text: 'Hello @Alic today', mentions: []}}
    );
  });
});

describe('snapOffset', () => {
  it('moves the caret out of a mention in the direction it was travelling', () => {
    expect(snapOffset(7, [MENTION], 6)).toBe(12);
    expect(snapOffset(11, [MENTION], 12)).toBe(6);
  });

  it('moves to the nearest edge without a direction', () => {
    expect(snapOffset(7, [MENTION])).toBe(6);
    expect(snapOffset(10, [MENTION])).toBe(12);
  });

  it('leaves offsets outside or on the edge of a mention alone', () => {
    expect(snapOffset(6, [MENTION], 3)).toBe(6);
    expect(snapOffset(12, [MENTION], 14)).toBe(12);
    expect(snapOffset(2, [MENTION], 9)).toBe(2);
  });
});

describe('getAtomicDeletionRange', () => {
  it('selects a whole mention for Backspace after it and Delete before it', () => {
    expect(getAtomicDeletionRange([MENTION], {start: 12, end: 12}, 'backward')).toEqual({
      start: 6,
      end: 12,
    });
    expect(getAtomicDeletionRange([MENTION], {start: 6, end: 6}, 'forward')).toEqual({
      start: 6,
      end: 12,
    });
  });

  it('leaves ordinary deletions alone', () => {
    expect(getAtomicDeletionRange([MENTION], {start: 6, end: 6}, 'backward')).toBeNull();
    expect(getAtomicDeletionRange([MENTION], {start: 12, end: 12}, 'forward')).toBeNull();
    expect(getAtomicDeletionRange([MENTION], {start: 0, end: 5}, 'backward')).toBeNull();
  });

  it('widens a selection that covers part of a mention', () => {
    expect(getAtomicDeletionRange([MENTION], {start: 3, end: 8}, 'backward')).toEqual({
      start: 3,
      end: 12,
    });
  });
});
