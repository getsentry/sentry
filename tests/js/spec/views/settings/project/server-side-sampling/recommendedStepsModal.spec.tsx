import {InjectedRouter} from 'react-router';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import * as indicators from 'sentry/actionCreators/indicator';
import GlobalModal from 'sentry/components/globalModal';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Organization, Project} from 'sentry/types';
import {SamplingInnerName} from 'sentry/types/sampling';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import ServerSideSampling from 'sentry/views/settings/project/server-side-sampling';
import {distributedTracesConditions} from 'sentry/views/settings/project/server-side-sampling/modals/specificConditionsModal/utils';
import {getInnerNameLabel} from 'sentry/views/settings/project/server-side-sampling/utils';
import importedUseProjectStats from 'sentry/views/settings/project/server-side-sampling/utils/useProjectStats';
import importedUseSamplingDistribution from 'sentry/views/settings/project/server-side-sampling/utils/useSamplingDistribution';

import {getMockData} from './index.spec';

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
const useProjectStats = importedUseProjectStats as jest.MockedFunction<
  typeof importedUseProjectStats
>;
useProjectStats.mockImplementation(() => ({
  projectStats: TestStubs.Outcomes(),
  loading: false,
  error: undefined,
  projectStatsSeries: [],
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
      name: 'snuba',
      slug: 'snuba',
      id: 3,
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

  beforeEach(function () {
    ProjectsStore.loadInitialData(mockedProjects);
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/projects/`,
      method: 'GET',
      body: mockedProjects,
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/dynamic-sampling/distribution/',
      method: 'GET',
      body: {
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
          {
            project: mockedProjects[2].slug,
            project_id: mockedProjects[2].id,
            'count()': 636,
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

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('render with all all steps', async function () {
    const {organization, projects, router} = getMockData({
      projects: mockedProjects,
    });

    render(
      <TestComponent organization={organization} project={projects[3]} router={router} />
    );

    expect(
      await screen.findByRole('button', {name: 'Learn More'}, {timeout: 2500})
    ).toBeInTheDocument();
    // userEvent.hover(screen.getByText('Add Rule'));
    // expect(
    //   await screen.findByText("You don't have permission to add a rule")
    // ).toBeInTheDocument();
  });
});
