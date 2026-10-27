import {ReplayErrorFrameFixture} from 'sentry-fixture/replay/error';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {getFrameDetails} from 'sentry/utils/replays/getFrameDetails';
import type {ReplayFrame} from 'sentry/utils/replays/types';

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

  describe('frames without data', () => {
    const base = {offsetMs: 0, timestamp: new Date(), timestampMs: 0, type: 'default'};
    const webVital = {
      ...base,
      op: 'web-vital',
      description: 'largest-contentful-paint',
      startTimestamp: new Date(),
      endTimestamp: new Date(),
      endTimestampMs: 0,
    };

    it.each([
      [
        'ui.slowClickDetected',
        'Click on an unknown element was slow to have a visible effect',
      ],
      ['ui.multiClick', 'Multiple clicks on an unknown element'],
      [
        'replay.mutations',
        'Significant mutations detected. This can slow down the Replay SDK, impacting your customers. Learn more.',
      ],
      ['device.battery', 'Device battery status is unknown'],
      ['device.connectivity', 'Device connectivity changed'],
      ['device.orientation', 'Device orientation was changed'],
      ['web-vital', 'No value recorded'],
    ])('describes a %s frame in a full sentence', (key, expected) => {
      const frame = key === 'web-vital' ? webVital : {...base, category: key};
      const {description} = getFrameDetails(frame as unknown as ReplayFrame);
      render(<div data-test-id="description">{description}</div>);
      expect(screen.getByTestId('description')).toHaveTextContent(expected, {
        normalizeWhitespace: true,
      });
    });

    it('shows the web-vital value when the rating is missing', () => {
      const frame = {...webVital, data: {value: 1234.567}};
      const {description} = getFrameDetails(frame as unknown as ReplayFrame);
      render(<div data-test-id="description">{description}</div>);
      expect(screen.getByTestId('description')).toHaveTextContent('1234.57ms');
    });
  });
});
