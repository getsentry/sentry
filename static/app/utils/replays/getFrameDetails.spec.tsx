import {ReplayErrorFrameFixture} from 'sentry-fixture/replay/error';

import {getFrameDetails} from 'sentry/utils/replays/getFrameDetails';

describe('getFrameDetails', () => {
  describe('issue frames', () => {
    it.each([
      ['fatal', 'danger'],
      ['error', 'danger'],
      ['', 'danger'],
      ['warning', 'warning'],
      ['info', 'neutral'],
      ['log', 'neutral'],
      ['debug', 'neutral'],
    ])('uses the %p level to pick the %p color', (level, color) => {
      const frame = ReplayErrorFrameFixture({
        timestamp: new Date('2024-01-01T00:00:00Z'),
        data: {level},
      });
      expect(getFrameDetails(frame).colorGraphicsToken).toBe(color);
    });
  });

  describe('defaultMapper (unknown frame types)', () => {
    it('uses frame.message when it is a string', () => {
      const frame: any = {
        op: 'unknown.custom',
        category: 'unknown.custom',
        timestamp: new Date('2024-01-01T00:00:00Z').getTime() / 1000,
        offsetMs: 0,
        timestampMs: 0,
        message: 'hello',
        data: {type: 'foo'},
      };
      expect(getFrameDetails(frame).description).toBe('hello');
    });

    it('falls back to frame.data when frame.message is a non-string object', () => {
      // frame.message could be a non-string at runtime (malformed frame data).
      // ?? only guards null/undefined, so without a typeof check the whole frame
      // object could become the description. We guard with typeof so the plain
      // object falls through to frame.data instead.
      const dataPayload = {type: 'foo', level: 'info', offsetMs: 0};
      const frame: any = {
        op: 'unknown.custom',
        category: 'unknown.custom',
        timestamp: new Date('2024-01-01T00:00:00Z').getTime() / 1000,
        offsetMs: 0,
        timestampMs: 0,
        message: {nested: 'object'}, // non-string at runtime
        data: dataPayload,
      };
      // Should fall back to frame.data, not use the non-string frame.message
      expect(getFrameDetails(frame).description).toBe(dataPayload);
    });

    it('returns empty string when both message and data are absent', () => {
      const frame: any = {
        op: 'unknown.custom',
        category: 'unknown.custom',
        timestamp: new Date('2024-01-01T00:00:00Z').getTime() / 1000,
        offsetMs: 0,
        timestampMs: 0,
        message: undefined,
        data: undefined,
      };
      expect(getFrameDetails(frame).description).toBe('');
    });
  });
});
