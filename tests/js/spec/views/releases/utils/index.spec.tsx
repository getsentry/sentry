import {initializeOrg} from 'sentry-test/initializeOrg';

import {getReleaseBounds, getReleaseParams} from 'app/views/releases/utils';

describe('releases/utils', () => {
  describe('getReleaseBounds', () => {
    it('returns start and end of a release', () => {
      // @ts-expect-error
      expect(getReleaseBounds(TestStubs.Release())).toEqual({
        releaseStart: '2020-03-23T01:02:00Z',
        releaseEnd: '2020-03-24T02:04:59Z',
      });
    });

    it('higher last session takes precendence over last event', () => {
      expect(
        getReleaseBounds(
          // @ts-expect-error
          TestStubs.Release({
            currentProjectMeta: {sessionsUpperBound: '2020-03-24T03:04:55Z'},
          })
        )
      ).toEqual({
        releaseStart: '2020-03-23T01:02:00Z',
        releaseEnd: '2020-03-24T03:04:59Z',
      });
    });

    it('there is no last session/event, it fallbacks to now', () => {
      // @ts-expect-error
      expect(getReleaseBounds(TestStubs.Release({lastEvent: null}))).toEqual({
        releaseStart: '2020-03-23T01:02:00Z',
        releaseEnd: '2017-10-17T02:41:59Z',
      });
    });

    it('adds 1 minute to end if start and end are within same minute', () => {
      expect(
        getReleaseBounds(
          // @ts-expect-error
          TestStubs.Release({
            dateCreated: '2020-03-23T01:02:30Z',
            lastEvent: '2020-03-23T01:02:39Z',
          })
        )
      ).toEqual({
        releaseStart: '2020-03-23T01:02:00Z',
        releaseEnd: '2020-03-23T01:03:59Z',
      });
    });
  });

  describe('getReleaseParams', () => {
    const {routerContext} = initializeOrg();
    // @ts-expect-error
    const releaseBounds = getReleaseBounds(TestStubs.Release());
    const defaultStatsPeriod = '14d';
    const allowEmptyPeriod = true;

    it('returns params related to a release', () => {
      const location = {
        ...routerContext.location,
        query: {
          pageStatsPeriod: '30d',
          project: ['456'],
          environment: ['prod'],
          somethingBad: 'meh',
        },
      };

      expect(
        getReleaseParams({
          location,
          releaseBounds,
          defaultStatsPeriod,
          allowEmptyPeriod,
        })
      ).toEqual({
        statsPeriod: '30d',
        project: ['456'],
        environment: ['prod'],
      });
    });

    it('returns release start/end if no other datetime is present', () => {
      expect(
        getReleaseParams({
          location: {...routerContext.location, query: {}},
          releaseBounds,
          defaultStatsPeriod,
          allowEmptyPeriod,
        })
      ).toEqual({
        start: '2020-03-23T01:02:00Z',
        end: '2020-03-24T02:04:59Z',
      });
    });

    it('returns correct start/end when zoomed in', () => {
      expect(
        getReleaseParams({
          location: {
            ...routerContext.location,
            query: {pageStart: '2021-03-23T01:02:30Z', pageEnd: '2022-03-23T01:02:30Z'},
          },
          releaseBounds,
          defaultStatsPeriod,
          allowEmptyPeriod,
        })
      ).toEqual({
        start: '2021-03-23T01:02:30.000',
        end: '2022-03-23T01:02:30.000',
      });
    });

    // used in releases without release-comparison feature flag
    it('returns default stats period', () => {
      expect(
        getReleaseParams({
          location: {...routerContext.location, query: {}},
          releaseBounds,
          defaultStatsPeriod: '7d',
          allowEmptyPeriod: false,
        })
      ).toEqual({
        statsPeriod: '7d',
      });
    });
  });
});
