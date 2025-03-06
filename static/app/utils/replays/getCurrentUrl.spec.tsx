import {
  ReplayNavigationFrameFixture,
  ReplayNavigationPushFrameFixture,
} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';
import {replayInitBreadcrumb} from 'sentry/utils/replays/hydrateBreadcrumbs';
import hydrateSpans from 'sentry/utils/replays/hydrateSpans';
import type {SpanFrame} from 'sentry/utils/replays/types';

const START_DATE = new Date('2022-06-15T00:40:00.111Z');
const NAVIGATION_DATE = new Date('2022-06-15T00:46:00.333Z');
const NEW_DOMAIN_DATE = new Date('2022-06-15T00:47:00.444Z');
const END_DATE = new Date('2022-06-15T00:50:00.555Z');

const replayRecord = ReplayRecordFixture({
  started_at: START_DATE,
  finished_at: END_DATE,
});

const PAGELOAD_FRAME = replayInitBreadcrumb(replayRecord);

const [NAV_FRAME, NEW_DOMAIN_FRAME] = hydrateSpans(replayRecord, [
  ReplayNavigationPushFrameFixture({
    description:
      '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
    startTimestamp: NAVIGATION_DATE,
    endTimestamp: NAVIGATION_DATE,
  }),
  ReplayNavigationFrameFixture({
    description: 'https://a062-174-94-6-155.ngrok.io/report/jquery.min.js',
    startTimestamp: NEW_DOMAIN_DATE,
    endTimestamp: NEW_DOMAIN_DATE,
  }),
]) as [SpanFrame, SpanFrame];

describe('getCurrentUrl', () => {
  it('should return the origin of the first url from the url array if the offset is early', () => {
    const frames = [PAGELOAD_FRAME, NAV_FRAME];
    const offsetMS = 0;
    const url = getCurrentUrl(ReplayRecordFixture(), frames, offsetMS);

    expect(url).toBe('http://localhost:3000/');
  });

  it('should return the first navigation url when the offset is after that', () => {
    const frames = [PAGELOAD_FRAME, NAV_FRAME];
    const offsetMS = Number(NAVIGATION_DATE) - Number(START_DATE) + 10;
    const url = getCurrentUrl(ReplayRecordFixture(), frames, offsetMS);

    expect(url).toBe(
      'http://localhost:3000/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js'
    );
  });

  it('should use the domain that is included in the ReplayRecord, not the one in the frame', () => {
    const frames = [NEW_DOMAIN_FRAME];
    const offsetMS = Number(NEW_DOMAIN_DATE) - Number(START_DATE) + 10;
    const url = getCurrentUrl(ReplayRecordFixture(), frames, offsetMS);

    expect(url).toBe('http://localhost:3000/report/jquery.min.js');
  });
});
