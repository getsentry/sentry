import React from 'react';
import isEqual from 'lodash/isEqual';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {HealthStatsPeriodOption} from 'app/types';
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
          project: [projectId],
          field: ['sum(session)'],
          groupBy: ['project', 'release', 'session.status'],
        });
      },
    }
  );

  // @ts-expect-error
  const requestForAutoHealthStatsPeriodSessionHistogram = MockApiClient.addMockResponse(
    {
      url: `/organizations/org-slug/sessions/`,
      // @ts-ignore Cannot find TestStubs
      body: TestStubs.SessionStatusCountByProjectInPeriod(),
    },
    {
      predicate(_url, {query}) {
        return isEqual(query, {
          query: undefined,
          interval: '1d',
          statsPeriod: '14d',
          project: [projectId],
          field: ['sum(session)'],
          groupBy: ['project', 'session.status'],
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
          project: [projectId],
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
          project: [projectId],
          field: ['sum(session)'],
          groupBy: ['project'],
        });
      },
    }
  );

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
          project: [projectId],
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
          project: [projectId],
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
          project: [projectId],
          field: ['count_unique(user)'],
          groupBy: ['project'],
        });
      },
    }
  );

  it('calculates correct session health data', async function () {
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
            project: [projectId],
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
      {
        data: [
          {name: 1615975200000, value: 51284},
          {name: 1615978800000, value: 43820},
          {name: 1615982400000, value: 46981},
          {name: 1615986000000, value: 56929},
          {name: 1615989600000, value: 59999},
          {name: 1615993200000, value: 60476},
          {name: 1615996800000, value: 54145},
          {name: 1616000400000, value: 52642},
          {name: 1616004000000, value: 42917},
          {name: 1616007600000, value: 35787},
          {name: 1616011200000, value: 35036},
          {name: 1616014800000, value: 29287},
          {name: 1616018400000, value: 24815},
          {name: 1616022000000, value: 19815},
          {name: 1616025600000, value: 16334},
          {name: 1616029200000, value: 16415},
          {name: 1616032800000, value: 18961},
          {name: 1616036400000, value: 17512},
          {name: 1616040000000, value: 18149},
          {name: 1616043600000, value: 17585},
          {name: 1616047200000, value: 25725},
          {name: 1616050800000, value: 36365},
          {name: 1616054400000, value: 48104},
          {name: 1616058000000, value: 6882},
        ],
        seriesName: 'Total Project',
        z: 0,
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
      {
        data: [
          {name: 1615975200000, value: 51284},
          {name: 1615978800000, value: 43820},
          {name: 1615982400000, value: 46981},
          {name: 1615986000000, value: 56929},
          {name: 1615989600000, value: 59999},
          {name: 1615993200000, value: 60476},
          {name: 1615996800000, value: 54145},
          {name: 1616000400000, value: 52642},
          {name: 1616004000000, value: 42917},
          {name: 1616007600000, value: 35787},
          {name: 1616011200000, value: 35036},
          {name: 1616014800000, value: 29287},
          {name: 1616018400000, value: 24815},
          {name: 1616022000000, value: 19815},
          {name: 1616025600000, value: 16334},
          {name: 1616029200000, value: 16415},
          {name: 1616032800000, value: 18961},
          {name: 1616036400000, value: 17512},
          {name: 1616040000000, value: 18149},
          {name: 1616043600000, value: 17585},
          {name: 1616047200000, value: 25725},
          {name: 1616050800000, value: 36365},
          {name: 1616054400000, value: 48104},
          {name: 1616058000000, value: 6882},
        ],
        seriesName: 'Total Project',
        z: 0,
      },
    ]);
    expect(
      healthData.getAdoption(
        'e102abb2c46e7fe8686441091005c12aed90da99',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toBe(0.7560125124855706);

    expect(requestForAutoHealthStatsPeriodSessionHistogram).toHaveBeenCalledTimes(0);
  });

  it('calculates correct user health data', async function () {
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
            project: [projectId],
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
      {
        data: [
          {name: 1615975200000, value: 1284},
          {name: 1615978800000, value: 3820},
          {name: 1615982400000, value: 6981},
          {name: 1615986000000, value: 6929},
          {name: 1615989600000, value: 9999},
          {name: 1615993200000, value: 1476},
          {name: 1615996800000, value: 4145},
          {name: 1616000400000, value: 2642},
          {name: 1616004000000, value: 2917},
          {name: 1616007600000, value: 5787},
          {name: 1616011200000, value: 5036},
          {name: 1616014800000, value: 9287},
          {name: 1616018400000, value: 4815},
          {name: 1616022000000, value: 9815},
          {name: 1616025600000, value: 6334},
          {name: 1616029200000, value: 6415},
          {name: 1616032800000, value: 8961},
          {name: 1616036400000, value: 7512},
          {name: 1616040000000, value: 8149},
          {name: 1616043600000, value: 7585},
          {name: 1616047200000, value: 5725},
          {name: 1616050800000, value: 6365},
          {name: 1616054400000, value: 8104},
          {name: 1616058000000, value: 882},
        ],
        seriesName: 'Total Project',
        z: 0,
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
      {
        data: [
          {name: 1615975200000, value: 1284},
          {name: 1615978800000, value: 3820},
          {name: 1615982400000, value: 6981},
          {name: 1615986000000, value: 6929},
          {name: 1615989600000, value: 9999},
          {name: 1615993200000, value: 1476},
          {name: 1615996800000, value: 4145},
          {name: 1616000400000, value: 2642},
          {name: 1616004000000, value: 2917},
          {name: 1616007600000, value: 5787},
          {name: 1616011200000, value: 5036},
          {name: 1616014800000, value: 9287},
          {name: 1616018400000, value: 4815},
          {name: 1616022000000, value: 9815},
          {name: 1616025600000, value: 6334},
          {name: 1616029200000, value: 6415},
          {name: 1616032800000, value: 8961},
          {name: 1616036400000, value: 7512},
          {name: 1616040000000, value: 8149},
          {name: 1616043600000, value: 7585},
          {name: 1616047200000, value: 5725},
          {name: 1616050800000, value: 6365},
          {name: 1616054400000, value: 8104},
          {name: 1616058000000, value: 882},
        ],
        seriesName: 'Total Project',
        z: 0,
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

  it('calculates correct session count histogram (auto period)', async function () {
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
            project: [projectId],
          },
        }}
        display={[DisplayOption.SESSIONS]}
        selection={selection}
        healthStatsPeriod={HealthStatsPeriodOption.AUTO}
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
      healthData.getTimeSeries(
        '7a82c130be9143361f20bc77252df783cf91e4fc',
        projectId,
        DisplayOption.SESSIONS
      )
    ).toEqual([
      {
        data: [
          {name: 1614902400000, value: 0},
          {name: 1614988800000, value: 0},
          {name: 1615075200000, value: 0},
          {name: 1615161600000, value: 0},
          {name: 1615248000000, value: 0},
          {name: 1615334400000, value: 0},
          {name: 1615420800000, value: 0},
          {name: 1615507200000, value: 0},
          {name: 1615593600000, value: 0},
          {name: 1615680000000, value: 0},
          {name: 1615766400000, value: 0},
          {name: 1615852800000, value: 0},
          {name: 1615939200000, value: 3446},
          {name: 1616025600000, value: 201136},
        ],
        seriesName: 'This Release',
      },
      {
        data: [
          {name: 1614902400000, value: 0},
          {name: 1614988800000, value: 0},
          {name: 1615075200000, value: 0},
          {name: 1615161600000, value: 0},
          {name: 1615248000000, value: 0},
          {name: 1615334400000, value: 0},
          {name: 1615420800000, value: 0},
          {name: 1615507200000, value: 0},
          {name: 1615593600000, value: 0},
          {name: 1615680000000, value: 0},
          {name: 1615766400000, value: 0},
          {name: 1615852800000, value: 0},
          {name: 1615939200000, value: 9268},
          {name: 1616025600000, value: 1083},
        ],
        seriesName: 'Total Project',
        z: 0,
      },
    ]);

    expect(requestForAutoHealthStatsPeriodSessionHistogram).toHaveBeenCalledTimes(1);
  });
});
