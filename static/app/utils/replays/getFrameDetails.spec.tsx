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
    it('serializes a plain-object frame.data to a string when message is absent', () => {
      // A frame whose category has no specific mapper, so defaultMapper is used.
      // frame.data is a plain object — this must not crash React rendering.
      const frame: any = {
        op: 'unknown.custom',
        category: 'unknown.custom',
        timestamp: new Date('2024-01-01T00:00:00Z').getTime() / 1000,
        offsetMs: 0,
        timestampMs: 0,
        message: undefined,
        data: {type: 'foo', level: 'info', offsetMs: 0},
      };
      const {description} = getFrameDetails(frame);
      // Must be a string, not a plain object, so React can render it safely
      expect(typeof description).toBe('string');
    });

    it('prefers frame.message over frame.data when both are present', () => {
      const frame: any = {
        op: 'unknown.custom',
        category: 'unknown.custom',
        timestamp: new Date('2024-01-01T00:00:00Z').getTime() / 1000,
        offsetMs: 0,
        timestampMs: 0,
        message: 'hello',
        data: {type: 'foo'},
      };
      const {description} = getFrameDetails(frame);
      expect(description).toBe('hello');
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
      const {description} = getFrameDetails(frame);
      expect(description).toBe('');
    });
  });
});
