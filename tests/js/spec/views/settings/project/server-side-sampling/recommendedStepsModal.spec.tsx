import {InjectedRouter} from 'react-router';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import GlobalModal from 'sentry/components/globalModal';
import {Organization, Project} from 'sentry/types';
import importedUseProjects from 'sentry/utils/useProjects';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import ServerSideSampling from 'sentry/views/settings/project/server-side-sampling';
import importedUseProjectStats from 'sentry/views/settings/project/server-side-sampling/utils/useProjectStats';
import importedUseSamplingDistribution from 'sentry/views/settings/project/server-side-sampling/utils/useSamplingDistribution';
import importedUseSdkVersions from 'sentry/views/settings/project/server-side-sampling/utils/useSdkVersions';

import {getMockData} from './index.spec';

const mockedProjects = [
  TestStubs.Project({
    name: 'javascript',
    slug: 'javascript',
    id: 1,
  }),
  TestStubs.Project({
    name: 'sentry',
    slug: 'sentry',
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

jest.mock('sentry/utils/useProjects');
const useProjects = importedUseProjects as jest.MockedFunction<
  typeof importedUseProjects
>;
useProjects.mockImplementation(() => ({
  projects: mockedProjects,
  fetchError: null,
  fetching: false,
  hasMore: false,
  initiallyLoaded: true,
  onSearch: jest.fn(),
  placeholders: [],
}));

jest.mock('sentry/views/settings/project/server-side-sampling/utils/useProjectStats');
const useProjectStats = importedUseProjectStats as jest.MockedFunction<
  typeof importedUseProjectStats
>;
useProjectStats.mockImplementation(() => ({
  projectStats: TestStubs.Outcomes(),
  loading: false,
  error: undefined,
  projectStatsSeries: [],
}));

jest.mock(
  'sentry/views/settings/project/server-side-sampling/utils/useSamplingDistribution'
);
const useSamplingDistribution = importedUseSamplingDistribution as jest.MockedFunction<
  typeof importedUseSamplingDistribution
>;

useSamplingDistribution.mockImplementation(() => ({
  samplingDistribution: {
    project_breakdown: [
      {
        project: mockedProjects[0].slug,
        project_id: mockedProjects[0].id,
        'count()': 888,
      },
      {
        project: mockedProjects[1].slug,
        project_id: mockedProjects[1].id,
        'count()': 100,
      },
    ],
    sample_size: 100,
    null_sample_rate_percentage: 98,
    sample_rate_distributions: {
      min: 1,
      max: 1,
      avg: 1,
      p50: 1,
      p90: 1,
      p95: 1,
      p99: 1,
    },
  },
}));

jest.mock('sentry/views/settings/project/server-side-sampling/utils/useSdkVersions');
const useSdkVersions = importedUseSdkVersions as jest.MockedFunction<
  typeof importedUseSdkVersions
>;

useSdkVersions.mockImplementation(() => ({
  samplingSdkVersions: [
    {
      project: mockedProjects[0].slug,
      latestSDKVersion: '1.0.3',
      latestSDKName: 'sentry.javascript.react',
      isSendingSampleRate: true,
    },
    {
      project: mockedProjects[1].slug,
      latestSDKVersion: '1.0.2',
      latestSDKName: 'sentry.python',
      isSendingSampleRate: false,
    },
  ],
}));

function TestComponent({
  router,
  project,
  organization,
}: {
  organization: Organization;
  project: Project;
  router: InjectedRouter;
}) {
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
      <GlobalModal />
      <OrganizationContext.Provider value={organization}>
        <ServerSideSampling project={project} />
      </OrganizationContext.Provider>
    </RouteContext.Provider>
  );
}

describe('Server-side Sampling - Recommended Steps Modal', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/projects/`,
      method: 'GET',
      body: mockedProjects,
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/tags/',
      body: TestStubs.Tags,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release/values/',
      method: 'GET',
      body: [{value: '1.2.3'}],
    });
  });

  // TODO(sampling): move this test to the main file
  it('display "update Sdk versions" alert', async function () {
    jest.spyOn(modal, 'openModal');

    const {organization, projects, router} = getMockData({
      projects: mockedProjects,
    });

    render(
      <TestComponent organization={organization} project={projects[2]} router={router} />
    );

    const recommendedSdkUpgradesAlert = await screen.findByTestId(
      'recommended-sdk-upgrades-alert'
    );

    expect(
      within(recommendedSdkUpgradesAlert).getByText(
        'To keep a consistent amount of transactions across your applications multiple services, we recommend you update the SDK versions for the following projects:'
      )
    ).toBeInTheDocument();

    expect(
      within(recommendedSdkUpgradesAlert).getByRole('link', {
        name: mockedProjects[1].slug,
      })
    ).toHaveAttribute(
      'href',
      `/organizations/org-slug/projects/sentry/?project=${mockedProjects[1].id}`
    );

    // Open Modal
    userEvent.click(
      within(recommendedSdkUpgradesAlert).getByRole('button', {
        name: 'Learn More',
      })
    );

    expect(openModal).toHaveBeenCalled();
  });
});
