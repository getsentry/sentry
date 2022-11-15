import {Fragment} from 'react';
import {InjectedRouter} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';

import GlobalModal from 'sentry/components/globalModal';
import {Organization, Outcome, Project} from 'sentry/types';
import {
  RecommendedSdkUpgrade,
  SamplingConditionOperator,
  SamplingDistribution,
  SamplingInnerName,
  SamplingInnerOperator,
  SamplingRule,
  SamplingRuleType,
  SamplingSdkVersion,
} from 'sentry/types/sampling';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import ServerSideSampling from 'sentry/views/settings/project/server-side-sampling';

export const outcomesWithoutClientDiscarded = {
  ...TestStubs.OutcomesWithReason(),
  groups: TestStubs.OutcomesWithReason().groups.filter(
    group => group.by.outcome !== Outcome.CLIENT_DISCARD
  ),
};

export const uniformRule: SamplingRule = {
  sampleRate: 0.5,
  type: SamplingRuleType.TRACE,
  active: false,
  condition: {
    op: SamplingConditionOperator.AND,
    inner: [],
  },
  id: 1,
};

export const specificRule: SamplingRule = {
  sampleRate: 0.2,
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
};

export const mockedProjects = [
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
];

export const mockedSamplingSdkVersions: SamplingSdkVersion[] = [
  {
    project: mockedProjects[0].slug,
    latestSDKVersion: '1.0.3',
    latestSDKName: 'sentry.javascript.react',
    isSendingSampleRate: true,
    isSendingSource: true,
    isSupportedPlatform: true,
  },
  {
    project: mockedProjects[1].slug,
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
];

export const recommendedSdkUpgrades: RecommendedSdkUpgrade[] = [
  {
    project: mockedProjects[1],
    latestSDKName: mockedSamplingSdkVersions[1].latestSDKName,
    latestSDKVersion: mockedSamplingSdkVersions[1].latestSDKVersion,
  },
];

export const mockedSamplingDistribution: SamplingDistribution = {
  projectBreakdown: [
    {
      project: mockedProjects[0].slug,
      projectId: mockedProjects[0].id,
      'count()': 888,
    },
    {
      project: mockedProjects[1].slug,
      projectId: mockedProjects[1].id,
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
};

export function getMockData({
  projects,
  access,
}: {access?: string[]; projects?: Project[]} = {}) {
  return initializeOrg({
    ...initializeOrg(),
    organization: {
      ...initializeOrg().organization,
      features: [
        'server-side-sampling',
        'dynamic-sampling-deprecated',
        'dynamic-sampling',
      ],
      access: access ?? initializeOrg().organization.access,
      projects,
    },
    projects,
  });
}

export function TestComponent({
  router,
  project,
  organization,
  withModal,
}: {
  organization: Organization;
  project: Project;
  router?: InjectedRouter;
  withModal?: boolean;
}) {
  const children = (
    <Fragment>
      {withModal && <GlobalModal />}
      <OrganizationContext.Provider value={organization}>
        <ServerSideSampling project={project} />
      </OrganizationContext.Provider>
    </Fragment>
  );

  if (router) {
    return (
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: {
            orgId: organization.slug,
            projectId: project.slug,
          },
          routes: [],
        }}
      >
        {children}
      </RouteContext.Provider>
    );
  }

  return children;
}
