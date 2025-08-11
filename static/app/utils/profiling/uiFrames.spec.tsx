import {UIFrames} from './uiFrames';

describe('UIFrames', () => {
  it('handles different render units', () => {
    const slowFrameRenders = {
      unit: 'nanoseconds',
      values: [{elapsed: 0, value: 1 * 1e6}],
    };
    const frozenFrameRenders = {
      unit: 'milliseconds',
      values: [{elapsed: 0, value: 1}],
    };

    const tree = new UIFrames(
      {slow: slowFrameRenders, frozen: frozenFrameRenders},
      {
        unit: 'milliseconds',
      }
    );

    expect(tree.frames[0]!.duration).toBe(tree.frames[1]!.duration);
  });

  it.each([
    [
      {unit: 'nanoseconds', values: []},
      {unit: 'nanoseconds', values: [{elapsed: 0, value: 1}]},
    ],
    [
      {unit: 'nanoseconds', values: [{elapsed: 0, value: 1}]},
      {unit: 'nanoseconds', values: []},
    ],
    [undefined, {unit: 'nanoseconds', values: [{elapsed: 0, value: 1}]}],
    [{unit: 'nanoseconds', values: [{elapsed: 0, value: 1}]}, undefined],
    [undefined, undefined],
  ])(
    `does not throw`,
    (
      slow: ConstructorParameters<typeof UIFrames>[0]['slow'],
      frozen: ConstructorParameters<typeof UIFrames>[0]['frozen']
    ) => {
      expect(
        () =>
          new UIFrames(
            {slow, frozen},
            {
              unit: 'milliseconds',
            }
          )
      ).not.toThrow();
    }
  );
});
