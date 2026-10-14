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
});
