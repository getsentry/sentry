import {Frame} from 'sentry/utils/profiling/frame';

describe('Frame', () => {
  describe('web', () => {
    it('sets anonymouse name if frame has no name', () => {
      expect(new Frame({key: 0, name: '', line: 0, column: 0}, 'web').name).toBe(
        '<anonymous>'
      );
    });

    it('appends [native code] to name if frame belongs to native code', () => {
      expect(
        new Frame(
          {key: 0, name: 'foo', line: undefined, column: undefined},
          'web'
        ).name.endsWith('[native code]')
      ).toBe(true);
    });
  });
});
