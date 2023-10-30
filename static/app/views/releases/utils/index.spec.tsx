import {initializeOrg} from 'sentry-test/initializeOrg';

import {getReleaseBounds, getReleaseParams, searchReleaseVersion} from './index';

describe('releases/utils', () => {
  describe('getReleaseBounds', () => {
    it('returns start and end of a release', () => {
      expect(getReleaseBounds(TestStubs.Release())).toEqual({
        releaseStart: '2020-03-23T01:02:00Z',
        releaseEnd: '2020-03-24T02:04:59Z',
        type: 'normal',
      });
    });

    it('higher last session takes precendence over last event', () => {
      expect(
        getReleaseBounds(
          TestStubs.Release({
            currentProjectMeta: {sessionsUpperBound: '2020-03-24T03:04:55Z'},
          })
        )
      ).toEqual({
        releaseStart: '2020-03-23T01:02:00Z',
        releaseEnd: '2020-03-24T03:04:59Z',
        type: 'normal',
      });
    });

    it('there is no last session/event, it fallbacks to now', () => {
      expect(getReleaseBounds(TestStubs.Release({lastEvent: null}))).toEqual({
        releaseStart: '2020-03-23T01:02:00Z',
        releaseEnd: '2017-10-17T02:41:59Z',
        type: 'normal',
      });
    });

    it('adds 1 minute to end if start and end are within same minute', () => {
      expect(
        getReleaseBounds(
          TestStubs.Release({
            dateCreated: '2020-03-23T01:02:30Z',
            lastEvent: '2020-03-23T01:02:39Z',
          })
        )
      ).toEqual({
        releaseStart: '2020-03-23T01:02:00Z',
        releaseEnd: '2020-03-23T01:03:59Z',
        type: 'normal',
      });
    });

    it('clamps active releases lasting longer than 90 days', () => {
      expect(
        getReleaseBounds(
          TestStubs.Release({
            dateCreated: '2017-05-17T02:41:20Z',
            lastEvent: '2017-10-12T02:41:20Z',
          })
        )
      ).toEqual({
        releaseStart: '2017-07-19T02:41:20Z',
        releaseEnd: '2017-10-12T02:41:59Z',
        type: 'clamped',
      });
    });

    it('defaults ancient releases to last 90 days', () => {
      expect(
        getReleaseBounds(
          TestStubs.Release({
            dateCreated: '2010-05-17T02:41:20Z',
            lastEvent: '2011-10-17T02:41:20Z',
          })
        )
      ).toEqual({
        releaseStart: '2017-07-19T02:41:20Z',
        releaseEnd: '2017-10-17T02:41:20Z',
        type: 'ancient',
      });
    });

    it('handles no lastEvent for ancient releases', () => {
      expect(
        getReleaseBounds(
          TestStubs.Release({
            dateCreated: '2010-05-17T02:41:20Z',
            lastEvent: null,
          })
        )
      ).toEqual({
        releaseStart: '2017-07-19T02:41:20Z',
        releaseEnd: '2017-10-17T02:41:20Z',
        type: 'ancient',
      });
    });
  });

  describe('getReleaseParams', () => {
    const {routerContext} = initializeOrg();
    const releaseBounds = getReleaseBounds(TestStubs.Release());

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
        })
      ).toEqual({
        start: '2021-03-23T01:02:30.000',
        end: '2022-03-23T01:02:30.000',
      });
    });
  });
});

describe('searchReleaseVersion()', function () {
  it('should escape quotes', function () {
    expect(searchReleaseVersion('com.sentry.go_app@"1.0.0-chore"')).toBe(
      'release:"com.sentry.go_app@\\"1.0.0-chore\\""'
    );
  });
});
