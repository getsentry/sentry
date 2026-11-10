import {
  getRenderableMentions,
  isSameComposerValue,
  replaceComposerValue,
  sliceComposerValue,
  type Mention,
} from './model';

const MENTION: Mention = {
  id: 'user:1',
  sourceId: 'members',
  start: 3,
  end: 9,
  text: '@Alice',
};

describe('getRenderableMentions', () => {
  it('keeps mentions that cover their own text, in order', () => {
    const later = {...MENTION, id: 'user:2', start: 14, end: 20};
    expect(
      getRenderableMentions({text: 'Hi @Alice and @Alice', mentions: [later, MENTION]})
    ).toEqual([MENTION, later]);
  });

  it.each([
    ['stale text', {...MENTION, text: '@Alex'}],
    ['out of range', {...MENTION, start: 30, end: 36}],
    ['empty range', {...MENTION, end: 3}],
  ])('drops mentions with %s', (_, mention) => {
    expect(getRenderableMentions({text: 'Hi @Alice', mentions: [mention]})).toEqual([]);
  });

  it('drops overlapping mentions', () => {
    const overlapping = {...MENTION, id: 'user:2', start: 4, end: 9, text: 'Alice'};
    expect(
      getRenderableMentions({text: 'Hi @Alice', mentions: [MENTION, overlapping]})
    ).toEqual([MENTION]);
  });
});

describe('isSameComposerValue', () => {
  it('compares text and every mention field', () => {
    const value = {text: 'Hi @Alice', mentions: [MENTION]};
    expect(
      isSameComposerValue(value, {text: 'Hi @Alice', mentions: [{...MENTION}]})
    ).toBe(true);
    expect(isSameComposerValue(value, {text: 'Hi @Alice', mentions: []})).toBe(false);
    expect(
      isSameComposerValue(value, {
        text: 'Hi @Alice',
        mentions: [{...MENTION, id: 'user:2'}],
      })
    ).toBe(false);
  });
});

describe('clipboard fragments', () => {
  const value = {
    text: 'Hi @Alice and @Alice',
    mentions: [MENTION, {...MENTION, start: 14, end: 20}],
  };

  it('copies a selected mention with fragment-relative offsets', () => {
    expect(sliceComposerValue(value, {start: 3, end: 13})).toEqual({
      text: '@Alice and',
      mentions: [{...MENTION, start: 0, end: 6}],
    });
  });

  it('copies partial mention text without a stale mention range', () => {
    expect(sliceComposerValue(value, {start: 4, end: 8})).toEqual({
      text: 'Alic',
      mentions: [],
    });
  });

  it('pastes a multiline fragment while preserving surrounding mentions', () => {
    expect(
      replaceComposerValue(
        value,
        {start: 9, end: 14},
        {
          text: '\n@Bob\n',
          mentions: [{...MENTION, id: 'user:2', text: '@Bob', start: 1, end: 5}],
        }
      )
    ).toEqual({
      text: 'Hi @Alice\n@Bob\n@Alice',
      mentions: [
        MENTION,
        {...MENTION, id: 'user:2', text: '@Bob', start: 10, end: 14},
        {...MENTION, start: 15, end: 21},
      ],
    });
  });

  it('removes replaced mentions and ignores invalid pasted mention ranges', () => {
    expect(
      replaceComposerValue(
        value,
        {start: 3, end: 9},
        {
          text: 'plain',
          mentions: [MENTION],
        }
      )
    ).toEqual({
      text: 'Hi plain and @Alice',
      mentions: [{...MENTION, start: 13, end: 19}],
    });
  });
});
