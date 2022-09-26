import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {Organization, Project} from 'sentry/types';
import {SamplingDistribution, SamplingSdkVersion} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';

export function fetchSamplingSdkVersions(): Promise<SamplingSdkVersion[]> {
  const response = [
    {
      project: 'frontend',
      latestSDKName: 'sentry.javascript.react',
      latestSDKVersion: '7.13.0',
      isSendingSampleRate: true,
      isSendingSource: true,
      isSupportedPlatform: true,
    },
    {
      project: 'database',
      latestSDKName: 'sentry.python',
      latestSDKVersion: '1.7.1',
      isSendingSampleRate: false,
      isSendingSource: false,
      isSupportedPlatform: true,
    },
    {
      project: 'backend',
      latestSDKName: 'sentry.python',
      latestSDKVersion: '1.9.8',
      isSendingSampleRate: true,
      isSendingSource: true,
      isSupportedPlatform: true,
    },
  ];

  ServerSideSamplingStore.sdkVersionsRequestSuccess(response);

  return new Promise(resolve => {
    resolve(response);
  });
}

export function fetchSamplingDistribution(): Promise<SamplingDistribution> {
  ServerSideSamplingStore.reset();

  ServerSideSamplingStore.distributionRequestLoading();

  const response = {
    project_breakdown: [
      {
        project_id: '1',
        project: 'frontend',
        'count()': 100,
      },
      {
        project_id: '2',
        project: 'backend',
        'count()': 1136,
      },
      {
        project_id: '3',
        project: 'database',
        'count()': 875,
      },
    ],
    sample_size: 100,
    null_sample_rate_percentage: 0,
    sample_rate_distributions: {
      min: 1,
      max: 1,
      avg: 1,
      p50: 1,
      p90: 1,
      p95: 1,
      p99: 1,
    },
    startTimestamp: '2022-09-26T10:18:32.698128Z',
    endTimestamp: '2022-09-26T11:18:32.698128Z',
  };

  ServerSideSamplingStore.distributionRequestSuccess(response);

  return new Promise(resolve => {
    resolve(response);
  });
}

function fetchProjectStats48h({
  api,
  orgSlug,
  projId,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  projId?: Project['id'];
}) {
  ServerSideSamplingStore.projectStats48hRequestLoading();

  const promise = api.requestPromise(`/organizations/${orgSlug}/stats_v2/`, {
    query: {
      project: projId,
      category: 'transaction',
      field: 'sum(quantity)',
      interval: '1h',
      statsPeriod: '48h',
      groupBy: 'outcome',
    },
  });

  promise
    .then(() =>
      ServerSideSamplingStore.projectStats48hRequestSuccess({
        query: '',
        start: '2022-09-24T12:00:00Z',
        end: '2022-09-26T11:23:00Z',
        intervals: [
          '2022-09-24T12:00:00Z',
          '2022-09-24T13:00:00Z',
          '2022-09-24T14:00:00Z',
          '2022-09-24T15:00:00Z',
          '2022-09-24T16:00:00Z',
          '2022-09-24T17:00:00Z',
          '2022-09-24T18:00:00Z',
          '2022-09-24T19:00:00Z',
          '2022-09-24T20:00:00Z',
          '2022-09-24T21:00:00Z',
          '2022-09-24T22:00:00Z',
          '2022-09-24T23:00:00Z',
          '2022-09-25T00:00:00Z',
          '2022-09-25T01:00:00Z',
          '2022-09-25T02:00:00Z',
          '2022-09-25T03:00:00Z',
          '2022-09-25T04:00:00Z',
          '2022-09-25T05:00:00Z',
          '2022-09-25T06:00:00Z',
          '2022-09-25T07:00:00Z',
          '2022-09-25T08:00:00Z',
          '2022-09-25T09:00:00Z',
          '2022-09-25T10:00:00Z',
          '2022-09-25T11:00:00Z',
          '2022-09-25T12:00:00Z',
          '2022-09-25T13:00:00Z',
          '2022-09-25T14:00:00Z',
          '2022-09-25T15:00:00Z',
          '2022-09-25T16:00:00Z',
          '2022-09-25T17:00:00Z',
          '2022-09-25T18:00:00Z',
          '2022-09-25T19:00:00Z',
          '2022-09-25T20:00:00Z',
          '2022-09-25T21:00:00Z',
          '2022-09-25T22:00:00Z',
          '2022-09-25T23:00:00Z',
          '2022-09-26T00:00:00Z',
          '2022-09-26T01:00:00Z',
          '2022-09-26T02:00:00Z',
          '2022-09-26T03:00:00Z',
          '2022-09-26T04:00:00Z',
          '2022-09-26T05:00:00Z',
          '2022-09-26T06:00:00Z',
          '2022-09-26T07:00:00Z',
          '2022-09-26T08:00:00Z',
          '2022-09-26T09:00:00Z',
          '2022-09-26T10:00:00Z',
          '2022-09-26T11:00:00Z',
        ],
        groups: [
          {
            by: {
              outcome: 'client_discard',
            },
            totals: {
              'sum(quantity)': 247709,
            },
            series: {
              'sum(quantity)': [
                2668, 2870, 2931, 3020, 2803, 2613, 2416, 2138, 2139, 2153, 1720, 1508,
                1317, 1102, 1177, 1286, 1489, 1576, 2061, 2350, 2497, 2743, 2583, 2873,
                2779, 3255, 2997, 2934, 2984, 2848, 2823, 2743, 2479, 2518, 2616, 2810,
                3998, 6135, 6388, 6281, 7485, 10812, 16828, 25035, 25102, 24801, 21100,
                7925,
              ],
            },
          },
          {
            by: {
              outcome: 'accepted',
            },
            totals: {
              'sum(quantity)': 247709,
            },
            series: {
              'sum(quantity)': [
                2668, 2870, 2931, 3020, 2803, 2613, 2416, 2138, 2139, 2153, 1720, 1508,
                1317, 1102, 1177, 1286, 1489, 1576, 2061, 2350, 2497, 2743, 2583, 2873,
                2779, 3255, 2997, 2934, 2984, 2848, 2823, 2743, 2479, 2518, 2616, 2810,
                3998, 6135, 6388, 6281, 7485, 10812, 16828, 25035, 25102, 24801, 21100,
                7925,
              ],
            },
          },
        ],
      })
    )
    .catch(response => {
      const errorMessage = t('Unable to fetch project stats from the last 48 hours');
      handleXhrErrorResponse(errorMessage)(response);
      ServerSideSamplingStore.projectStats48hRequestError(errorMessage);
    });

  return promise;
}

function fetchProjectStats30d({
  api,
  orgSlug,
  projId,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  projId?: Project['id'];
}) {
  ServerSideSamplingStore.projectStats30dRequestLoading();

  const promise = api.requestPromise(`/organizations/${orgSlug}/stats_v2/`, {
    query: {
      project: projId,
      category: 'transaction',
      field: 'sum(quantity)',
      interval: '1d',
      statsPeriod: '30d',
      groupBy: ['outcome', 'reason'],
    },
  });

  promise
    .then(() =>
      ServerSideSamplingStore.projectStats30dRequestSuccess({
        query: '',
        start: '2022-08-28T00:00:00Z',
        end: '2022-09-26T11:23:00Z',
        intervals: [
          '2022-08-28T00:00:00Z',
          '2022-08-29T00:00:00Z',
          '2022-08-30T00:00:00Z',
          '2022-08-31T00:00:00Z',
          '2022-09-01T00:00:00Z',
          '2022-09-02T00:00:00Z',
          '2022-09-03T00:00:00Z',
          '2022-09-04T00:00:00Z',
          '2022-09-05T00:00:00Z',
          '2022-09-06T00:00:00Z',
          '2022-09-07T00:00:00Z',
          '2022-09-08T00:00:00Z',
          '2022-09-09T00:00:00Z',
          '2022-09-10T00:00:00Z',
          '2022-09-11T00:00:00Z',
          '2022-09-12T00:00:00Z',
          '2022-09-13T00:00:00Z',
          '2022-09-14T00:00:00Z',
          '2022-09-15T00:00:00Z',
          '2022-09-16T00:00:00Z',
          '2022-09-17T00:00:00Z',
          '2022-09-18T00:00:00Z',
          '2022-09-19T00:00:00Z',
          '2022-09-20T00:00:00Z',
          '2022-09-21T00:00:00Z',
          '2022-09-22T00:00:00Z',
          '2022-09-23T00:00:00Z',
          '2022-09-24T00:00:00Z',
          '2022-09-25T00:00:00Z',
          '2022-09-26T00:00:00Z',
        ],
        groups: [
          {
            by: {
              outcome: 'accepted',
              reason: 'none',
            },
            totals: {
              'sum(quantity)': 7465041,
            },
            series: {
              'sum(quantity)': [
                57489, 339086, 351731, 331622, 340585, 280864, 52046, 58765, 292206,
                358821, 348000, 337769, 282382, 54714, 57486, 363473, 362767, 351190,
                350794, 296417, 56938, 64517, 364178, 388965, 377535, 362605, 304525,
                58688, 56840, 162043,
              ],
            },
          },
          {
            by: {
              reason: 'sample_rate',
              outcome: 'client_discard',
            },
            totals: {
              'sum(quantity)': 7465041,
            },
            series: {
              'sum(quantity)': [
                57489, 339086, 351731, 331622, 340585, 280864, 52046, 58765, 292206,
                358821, 348000, 337769, 282382, 54714, 57486, 363473, 362767, 351190,
                350794, 296417, 56938, 64517, 364178, 388965, 377535, 362605, 304525,
                58688, 56840, 162043,
              ],
            },
          },
        ],
      })
    )
    .catch(response => {
      const errorMessage = t('Unable to fetch project stats from the last 30 days');
      handleXhrErrorResponse(errorMessage)(response);
      ServerSideSamplingStore.projectStats30dRequestError(errorMessage);
    });

  return promise;
}

export function fetchProjectStats(props: {
  api: Client;
  orgSlug: Organization['slug'];
  projId?: Project['id'];
}) {
  return Promise.all([fetchProjectStats48h(props), fetchProjectStats30d(props)]);
}
