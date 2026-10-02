import {getFrameDetails} from 'sentry/utils/replays/getFrameDetails';
import type {ErrorFrame} from 'sentry/utils/replays/types';

function makeErrorFrame(level: string): ErrorFrame {
  const timestamp = new Date('2024-01-01T00:00:00Z');
  return {
    category: 'issue',
    data: {
      eventId: 'abc123',
      groupId: 1,
      groupShortId: 'PROJ-1',
      label: '',
      labels: [],
      level,
      projectSlug: 'proj',
    },
    message: 'Something happened',
    offsetMs: 0,
    timestamp,
    timestampMs: timestamp.getTime(),
    type: 'error',
  };
}

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
      expect(getFrameDetails(makeErrorFrame(level)).colorGraphicsToken).toBe(color);
    });
  });
});
