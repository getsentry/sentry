import {
  SamplingConditionOperator,
  SamplingInnerName,
  SamplingInnerOperator,
  SamplingRuleType,
} from 'sentry/types/sampling';

export function DynamicSamplingConfig(params = {}) {
  return {
    uniformRule: {
      sampleRate: 0.5,
      type: SamplingRuleType.TRACE,
      active: true,
      condition: {
        op: SamplingConditionOperator.AND,
        inner: [],
      },
      id: 1,
    },
    specificRule: {
      sampleRate: 0.6,
      active: false,
      type: SamplingRuleType.TRACE,
      condition: {
        op: SamplingConditionOperator.AND,
        inner: [
          {
            op: SamplingInnerOperator.GLOB_MATCH,
            name: SamplingInnerName.TRACE_RELEASE,
            value: ['1.2.2'],
          },
        ],
      },
      id: 2,
    },
    samplingSdkVersions: [
      {
        project: 'javascript',
        latestSDKVersion: '1.0.3',
        latestSDKName: 'sentry.javascript.react',
        isSendingSampleRate: true,
        isSendingSource: true,
        isSupportedPlatform: true,
      },
      {
        project: 'sentry',
        latestSDKVersion: '1.0.2',
        latestSDKName: 'sentry.python',
        isSendingSampleRate: false,
        isSendingSource: false,
        isSupportedPlatform: true,
      },
      {
        project: 'java',
        latestSDKVersion: '1.0.2',
        latestSDKName: 'sentry.java',
        isSendingSampleRate: true,
        isSendingSource: false,
        isSupportedPlatform: true,
      },
      {
        project: 'angular',
        latestSDKVersion: '1.0.2',
        latestSDKName: 'sentry.javascript.angular',
        isSendingSampleRate: false,
        isSendingSource: false,
        isSupportedPlatform: false,
      },
    ],
    samplingDistribution: {
      projectBreakdown: [
        {
          project: 'javascript',
          projectId: 1,
          'count()': 888,
        },
        {
          project: 'sentry',
          projectId: 2,
          'count()': 100,
        },
      ],
      parentProjectBreakdown: [
        {
          percentage: 10,
          project: 'parent-project',
          projectId: 10,
        },
      ],
      sampleSize: 100,
      startTimestamp: '2017-08-04T07:52:11Z',
      endTimestamp: '2017-08-05T07:52:11Z',
    },
    projects: [
      TestStubs.Project({
        name: 'javascript',
        slug: 'javascript',
        id: 1,
      }),
      TestStubs.Project({
        name: 'sentry',
        slug: 'sentry',
        platform: 'python',
        id: 2,
      }),
      TestStubs.Project({
        id: 4,
        dynamicSampling: {
          rules: [
            {
              sampleRate: 1,
              type: 'trace',
              active: false,
              condition: {
                op: 'and',
                inner: [],
              },
              id: 1,
            },
          ],
        },
      }),
    ],
    recommendedSdkUpgrades: [
      {
        project: TestStubs.Project({
          name: 'sentry',
          slug: 'sentry',
          platform: 'python',
          id: 2,
        }),
        latestSDKVersion: '1.0.2',
        latestSDKName: 'sentry.python',
      },
    ],
    ...params,
  };
}
