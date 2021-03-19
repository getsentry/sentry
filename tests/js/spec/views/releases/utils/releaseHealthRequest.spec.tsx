import React from 'react';
import isEqual from 'lodash/isEqual';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {DisplayOption} from 'app/views/releases/list/utils';
import ReleaseHealthRequest from 'app/views/releases/utils/releaseHealthRequest';

describe('ReleaseHealthRequest', function () {
  const {organization, routerContext, router} = initializeOrg();
  const projectId = 123;
  const selection = {
    projects: [projectId],
    environments: [],
    datetime: {
      period: '14d',
      start: null,
      end: null,
      utc: false,
    },
  };

  it('calculates correct session health data', async function () {
    // @ts-expect-error
    MockApiClient.addMockResponse(
      {
        url: `/organizations/org-slug/sessions/`,
        // @ts-ignore Cannot find TestStubs
        body: TestStubs.SessionStatusCountByReleaseInPeriod(),
      },
      {
        predicate(_url, {query}) {
          return isEqual(query, {
            query:
              'release:7a82c130be9143361f20bc77252df783cf91e4fc OR release:e102abb2c46e7fe8686441091005c12aed90da99',
            interval: '1d',
            statsPeriod: '14d',
            project: ['projectId'],
            field: ['sum(session)'],
            groupBy: ['project', 'release', 'session.status'],
          });
        },
      }
    );

    // @ts-expect-error
    MockApiClient.addMockResponse(
      {
        url: `/organizations/${organization.slug}/sessions/`,
        // @ts-ignore Cannot find TestStubs
        body: TestStubs.SesssionTotalCountByReleaseIn24h(),
      },
      {
        predicate(_url, {query}) {
          return isEqual(query, {
            query:
              'release:7a82c130be9143361f20bc77252df783cf91e4fc OR release:e102abb2c46e7fe8686441091005c12aed90da99',
            interval: '1h',
            statsPeriod: '24h',
            project: ['projectId'],
            field: ['sum(session)'],
            groupBy: ['project', 'release'],
          });
        },
      }
    );

    // @ts-expect-error
    MockApiClient.addMockResponse(
      {
        url: `/organizations/org-slug/sessions/`,
        // @ts-ignore Cannot find TestStubs
        body: TestStubs.SessionTotalCountByProjectIn24h(),
      },
      {
        predicate(_url, {query}) {
          return isEqual(query, {
            query: undefined,
            interval: '1h',
            statsPeriod: '24h',
            project: ['projectId'],
            field: ['sum(session)'],
            groupBy: ['project'],
          });
        },
      }
    );

    let healthData;

    const wrapper = mountWithTheme(
      <ReleaseHealthRequest
        releases={[
          '7a82c130be9143361f20bc77252df783cf91e4fc',
          'e102abb2c46e7fe8686441091005c12aed90da99',
        ]}
        organization={organization}
        location={{
          ...router.location,
          query: {
            project: ['projectId'],
          },
        }}
        display={[DisplayOption.SESSIONS]}
        selection={selection}
      >
        {({getHealthData}) => {
          healthData = getHealthData;
          return null;
        }}
      </ReleaseHealthRequest>,
      routerContext
    );

    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(
      healthData.getCrashCount(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(492);
    expect(
      healthData.getCrashFreeRate(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(99.76);
    expect(
      healthData.get24hCountByRelease(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(219826);
    expect(healthData.get24hCountByProject(projectId, DisplayOption.SESSIONS)).toBe(
      835965
    );
    expect(
      healthData.getTimeSeries(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toEqual([
      {
        data: [
          {name: 1615975200000, value: 0},
          {name: 1615978800000, value: 0},
          {name: 1615982400000, value: 0},
          {name: 1615986000000, value: 0},
          {name: 1615989600000, value: 0},
          {name: 1615993200000, value: 0},
          {name: 1615996800000, value: 0},
          {name: 1616000400000, value: 0},
          {name: 1616004000000, value: 0},
          {name: 1616007600000, value: 0},
          {name: 1616011200000, value: 0},
          {name: 1616014800000, value: 0},
          {name: 1616018400000, value: 0},
          {name: 1616022000000, value: 3444},
          {name: 1616025600000, value: 14912},
          {name: 1616029200000, value: 15649},
          {name: 1616032800000, value: 18019},
          {name: 1616036400000, value: 16726},
          {name: 1616040000000, value: 17540},
          {name: 1616043600000, value: 16970},
          {name: 1616047200000, value: 25015},
          {name: 1616050800000, value: 34686},
          {name: 1616054400000, value: 46434},
          {name: 1616058000000, value: 10431},
        ],
        seriesName: 'This Release',
      },
    ]);
    expect(
      healthData.getAdoption(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(26.29607698886915);

    expect(
      healthData.getCrashCount(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(5);
    expect(
      healthData.getCrashFreeRate(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(99.921);
    expect(
      healthData.get24hCountByRelease(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(6320);
    expect(healthData.get24hCountByProject(projectId, DisplayOption.SESSIONS)).toBe(
      835965
    );
    expect(
      healthData.getTimeSeries(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toEqual([
      {
        data: [
          {name: 1615975200000, value: 0},
          {name: 1615978800000, value: 0},
          {name: 1615982400000, value: 0},
          {name: 1615986000000, value: 0},
          {name: 1615989600000, value: 0},
          {name: 1615993200000, value: 0},
          {name: 1615996800000, value: 0},
          {name: 1616000400000, value: 0},
          {name: 1616004000000, value: 0},
          {name: 1616007600000, value: 0},
          {name: 1616011200000, value: 0},
          {name: 1616014800000, value: 0},
          {name: 1616018400000, value: 0},
          {name: 1616022000000, value: 5809},
          {name: 1616025600000, value: 400},
          {name: 1616029200000, value: 22},
          {name: 1616032800000, value: 26},
          {name: 1616036400000, value: 12},
          {name: 1616040000000, value: 19},
          {name: 1616043600000, value: 8},
          {name: 1616047200000, value: 0},
          {name: 1616050800000, value: 19},
          {name: 1616054400000, value: 5},
          {name: 1616058000000, value: 0},
        ],
        seriesName: 'This Release',
      },
    ]);
    expect(
      healthData.getAdoption(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(0.7560125124855706);
  });

  it('calculates correct user health data', async function () {
    // @ts-expect-error
    MockApiClient.addMockResponse(
      {
        url: `/organizations/org-slug/sessions/`,
        // @ts-ignore Cannot find TestStubs
        body: TestStubs.SessionUserStatusCountByReleaseInPeriod(),
      },
      {
        predicate(_url, {query}) {
          return isEqual(query, {
            query:
              'release:7a82c130be9143361f20bc77252df783cf91e4fc OR release:e102abb2c46e7fe8686441091005c12aed90da99',
            interval: '1d',
            statsPeriod: '14d',
            project: ['projectId'],
            field: ['count_unique(user)', 'sum(session)'],
            groupBy: ['project', 'release', 'session.status'],
          });
        },
      }
    );

    // @ts-expect-error
    MockApiClient.addMockResponse(
      {
        url: `/organizations/${organization.slug}/sessions/`,
        // @ts-ignore Cannot find TestStubs
        body: TestStubs.UserTotalCountByReleaseIn24h(),
      },
      {
        predicate(_url, {query}) {
          return isEqual(query, {
            query:
              'release:7a82c130be9143361f20bc77252df783cf91e4fc OR release:e102abb2c46e7fe8686441091005c12aed90da99',
            interval: '1h',
            statsPeriod: '24h',
            project: ['projectId'],
            field: ['count_unique(user)'],
            groupBy: ['project', 'release'],
          });
        },
      }
    );

    // @ts-expect-error
    MockApiClient.addMockResponse(
      {
        url: `/organizations/org-slug/sessions/`,
        // @ts-ignore Cannot find TestStubs
        body: TestStubs.UserTotalCountByProjectIn24h(),
      },
      {
        predicate(_url, {query}) {
          return isEqual(query, {
            query: undefined,
            interval: '1h',
            statsPeriod: '24h',
            project: ['projectId'],
            field: ['count_unique(user)'],
            groupBy: ['project'],
          });
        },
      }
    );

    let healthData;

    const wrapper = mountWithTheme(
      <ReleaseHealthRequest
        releases={[
          '7a82c130be9143361f20bc77252df783cf91e4fc',
          'e102abb2c46e7fe8686441091005c12aed90da99',
        ]}
        organization={organization}
        location={{
          ...router.location,
          query: {
            project: ['projectId'],
          },
        }}
        display={[DisplayOption.USERS]}
        selection={selection}
      >
        {({getHealthData}) => {
          healthData = getHealthData;
          return null;
        }}
      </ReleaseHealthRequest>,
      routerContext
    );

    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(
      healthData.getCrashCount(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(492);
    expect(
      healthData.getCrashFreeRate(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.USERS
      )
    ).toBe(99.908);
    expect(
      healthData.get24hCountByRelease(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.USERS
      )
    ).toBe(56826);
    expect(healthData.get24hCountByProject(projectId, DisplayOption.USERS)).toBe(140965);
    expect(
      healthData.getTimeSeries(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.USERS
      )
    ).toEqual([
      {
        data: [
          {name: 1615975200000, value: 0},
          {name: 1615978800000, value: 0},
          {name: 1615982400000, value: 0},
          {name: 1615986000000, value: 0},
          {name: 1615989600000, value: 0},
          {name: 1615993200000, value: 0},
          {name: 1615996800000, value: 0},
          {name: 1616000400000, value: 0},
          {name: 1616004000000, value: 0},
          {name: 1616007600000, value: 0},
          {name: 1616011200000, value: 0},
          {name: 1616014800000, value: 0},
          {name: 1616018400000, value: 0},
          {name: 1616022000000, value: 444},
          {name: 1616025600000, value: 4912},
          {name: 1616029200000, value: 5649},
          {name: 1616032800000, value: 8019},
          {name: 1616036400000, value: 6726},
          {name: 1616040000000, value: 7540},
          {name: 1616043600000, value: 6970},
          {name: 1616047200000, value: 5015},
          {name: 1616050800000, value: 4686},
          {name: 1616054400000, value: 6434},
          {name: 1616058000000, value: 431},
        ],
        seriesName: 'This Release',
      },
    ]);
    expect(
      healthData.getAdoption(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.USERS
      )
    ).toBe(40.31213421771362);

    expect(
      healthData.getCrashCount(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(5);
    expect(
      healthData.getCrashFreeRate(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.USERS
      )
    ).toBe(99.87);
    expect(
      healthData.get24hCountByRelease(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.USERS
      )
    ).toBe(850);
    expect(healthData.get24hCountByProject(projectId, DisplayOption.USERS)).toBe(140965);
    expect(
      healthData.getTimeSeries(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.USERS
      )
    ).toEqual([
      {
        data: [
          {name: 1615975200000, value: 0},
          {name: 1615978800000, value: 0},
          {name: 1615982400000, value: 0},
          {name: 1615986000000, value: 0},
          {name: 1615989600000, value: 0},
          {name: 1615993200000, value: 0},
          {name: 1615996800000, value: 0},
          {name: 1616000400000, value: 0},
          {name: 1616004000000, value: 0},
          {name: 1616007600000, value: 0},
          {name: 1616011200000, value: 0},
          {name: 1616014800000, value: 0},
          {name: 1616018400000, value: 0},
          {name: 1616022000000, value: 809},
          {name: 1616025600000, value: 0},
          {name: 1616029200000, value: 2},
          {name: 1616032800000, value: 6},
          {name: 1616036400000, value: 2},
          {name: 1616040000000, value: 9},
          {name: 1616043600000, value: 8},
          {name: 1616047200000, value: 0},
          {name: 1616050800000, value: 9},
          {name: 1616054400000, value: 5},
          {name: 1616058000000, value: 0},
        ],
        seriesName: 'This Release',
      },
    ]);
    expect(
      healthData.getAdoption(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.USERS
      )
    ).toBe(0.6029865569467598);
  });
});
