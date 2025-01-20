import {ReplayNavFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import getCurrentScreenName from 'sentry/utils/replays/getCurrentScreenName';
import hydrateBreadcrumbs, {
  replayInitBreadcrumb,
} from 'sentry/utils/replays/hydrateBreadcrumbs';
import type {BreadcrumbFrame} from 'sentry/utils/replays/types';

const START_DATE = new Date('2022-06-15T00:40:00.111Z');
const NAVIGATION_DATE_1 = new Date('2022-06-15T00:46:00.333Z');
const NAVIGATION_DATE_2 = new Date('2022-06-15T00:48:00.444Z');
const END_DATE = new Date('2022-06-15T00:50:00.555Z');

const replayRecord = ReplayRecordFixture({
  started_at: START_DATE,
  finished_at: END_DATE,
});

const PAGELOAD_FRAME = replayInitBreadcrumb(replayRecord);

const [NAV_FRAME_1, NAV_FRAME_2] = hydrateBreadcrumbs(replayRecord, [
  ReplayNavFrameFixture({
    data: {to: 'MainActivityScreen'},
    timestamp: NAVIGATION_DATE_1,
  }),
  ReplayNavFrameFixture({
    data: {to: 'ConfirmPayment'},
    timestamp: NAVIGATION_DATE_2,
  }),
]);

describe('getCurrentScreenName', () => {
  it('should return the screen name based on the closest navigation crumb', () => {
    const frames = [PAGELOAD_FRAME, NAV_FRAME_1, NAV_FRAME_2] as BreadcrumbFrame[];

    const offsetMS = 0; // at the beginning
    const screenName = getCurrentScreenName(
      ReplayRecordFixture({urls: ['MainActivityScreen', 'ConfirmPayment']}),
      frames,
      offsetMS
    );
    expect(screenName).toBe('MainActivityScreen');

    const offsetMS2 = Number(NAVIGATION_DATE_1) - Number(START_DATE) + 3;
    const screenName2 = getCurrentScreenName(replayRecord, frames, offsetMS2);
    expect(screenName2).toBe('MainActivityScreen');

    const offsetMS3 = Number(NAVIGATION_DATE_2) - Number(START_DATE) + 1;
    const screenName3 = getCurrentScreenName(replayRecord, frames, offsetMS3);
    expect(screenName3).toBe('ConfirmPayment');
  });
});
