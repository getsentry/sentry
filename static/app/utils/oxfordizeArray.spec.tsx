import oxfordizeArray from 'sentry/utils/oxfordizeArray';

describe('oxfordizeArray', () => {
  it('correctly formats lists of strings', () => {
    const zero: string[] = [];
    const one = ['A'];
    const two = ['A', 'B'];
    const three = ['A', 'B', 'C'];
    const four = ['A', 'B', 'C', 'D'];

    expect(oxfordizeArray(zero)).toBe('');
    expect(oxfordizeArray(one)).toBe('A');
    expect(oxfordizeArray(two)).toBe('A and B');
    expect(oxfordizeArray(three)).toBe('A, B, and C');
    expect(oxfordizeArray(four)).toBe('A, B, C, and D');
  });
});
