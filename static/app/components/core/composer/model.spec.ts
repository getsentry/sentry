import {getRenderableMentions, isSameComposerValue, type Mention} from './model';

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
