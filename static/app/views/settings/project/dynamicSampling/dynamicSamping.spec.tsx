import {
  createMemoryHistory,
  IndexRoute,
  Route,
  Router,
  RouterContext,
} from 'react-router';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {Organization, Project} from 'sentry/types';
import {SamplingSdkVersion} from 'sentry/types/sampling';
import {RouteContext} from 'sentry/views/routeContext';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/dynamicSampling/utils';

import {samplingBreakdownTitle} from './samplingBreakdown.spec';
import {
  getMockData,
  mockedSamplingDistribution,
  mockedSamplingSdkVersions,
  specificRule,
  TestComponent,
  uniformRule,
} from './testUtils';

function renderMockRequests({
  organizationSlug,
  projectSlug,
  mockedSdkVersionsResponse = mockedSamplingSdkVersions,
}: {
  organizationSlug: Organization['slug'];
  projectSlug: Project['slug'];
  mockedSdkVersionsResponse?: SamplingSdkVersion[];
}) {
  const distribution = MockApiClient.addMockResponse({
    url: `/projects/${organizationSlug}/${projectSlug}/dynamic-sampling/distribution/`,
    method: 'GET',
    body: mockedSamplingDistribution,
  });

  const sdkVersions = MockApiClient.addMockResponse({
    url: `/organizations/${organizationSlug}/dynamic-sampling/sdk-versions/`,
    method: 'GET',
    body: mockedSdkVersionsResponse,
  });

  const projects = MockApiClient.addMockResponse({
    url: `/organizations/${organizationSlug}/projects/`,
    method: 'GET',
    body: mockedSamplingDistribution.projectBreakdown!.map(p =>
      TestStubs.Project({id: p.projectId, slug: p.project})
    ),
  });

  const statsV2 = MockApiClient.addMockResponse({
    url: `/organizations/${organizationSlug}/stats_v2/`,
    method: 'GET',
    body: TestStubs.Outcomes(),
  });

  return {distribution, sdkVersions, projects, statsV2};
}

describe('Dynamic Sampling', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders rules panel', async function () {
    const {router, organization, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [{...uniformRule, sampleRate: 1}],
          },
        }),
      ],
    });

    renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: project.slug,
    });

    const {container} = render(
      <TestComponent router={router} organization={organization} project={project} />
    );

    // Assert that project breakdown is there
    expect(await screen.findByText(samplingBreakdownTitle)).toBeInTheDocument();

    // Rule Panel Header
    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Rule Panel Content
    expect(screen.getAllByTestId('sampling-rule').length).toBe(1);
    expect(screen.queryByLabelText('Drag Rule')).not.toBeInTheDocument();
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('If');
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('All');
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('100%');
    expect(screen.queryByLabelText('Activate Rule')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Actions')).not.toBeInTheDocument();

    // hover over the rule toggle
    userEvent.hover(screen.getByRole('checkbox'));

    // Assert that the tooltip is there
    expect(
      await screen.findByText('Uniform rule is always active and cannot be toggled')
    ).toBeInTheDocument();

    // Rule Panel Footer
    expect(screen.getByText('Add Rule')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );

    expect(container).toSnapshot();
  });

  it('open specific conditions modal when adding rule', async function () {
    const {project, organization} = getMockData({
      projects: [
        TestStubs.Project({
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
    });

    const mockRequests = renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: project.slug,
    });

    const memoryHistory = createMemoryHistory();

    memoryHistory.push(
      `/settings/${organization.slug}/projects/${project.slug}/dynamic-sampling/`
    );

    function DynamicSamplingPage() {
      return <TestComponent organization={organization} project={project} withModal />;
    }

    function AlternativePage() {
      return <div>alternative page</div>;
    }

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route
          path={`/settings/${organization.slug}/projects/${project.slug}/dynamic-sampling/`}
        >
          <IndexRoute component={DynamicSamplingPage} />
          <Route path="rules/:rule/" component={DynamicSamplingPage} />
        </Route>
        <Route path="mock-path" component={AlternativePage} />
      </Router>
    );

    // Store is reset on the first load
    expect(ServerSideSamplingStore.getState().projectStats48h.data).toBe(undefined);
    expect(ServerSideSamplingStore.getState().projectStats30d.data).toBe(undefined);
    expect(ServerSideSamplingStore.getState().distribution.data).toBe(undefined);
    expect(ServerSideSamplingStore.getState().sdkVersions.data).toBe(undefined);

    // Store is updated with request responses on first load
    await waitFor(() => {
      expect(ServerSideSamplingStore.getState().sdkVersions.data).not.toBe(undefined);
    });
    expect(ServerSideSamplingStore.getState().projectStats48h.data).not.toBe(undefined);
    expect(ServerSideSamplingStore.getState().projectStats30d.data).not.toBe(undefined);
    expect(ServerSideSamplingStore.getState().distribution.data).not.toBe(undefined);

    // Open Modal (new route)
    userEvent.click(screen.getByLabelText('Add Rule'));

    expect(await screen.findByRole('heading', {name: 'Add Rule'})).toBeInTheDocument();

    // In a new route, if the store contains the required values, no further requests are sent
    expect(mockRequests.statsV2).toHaveBeenCalledTimes(2);
    expect(mockRequests.distribution).toHaveBeenCalledTimes(1);
    expect(mockRequests.sdkVersions).toHaveBeenCalledTimes(1);

    // Leave dynamic sampling's page
    memoryHistory.push(`mock-path`);

    // When leaving dynamic sampling's page the ServerSideSamplingStore is reset
    expect(ServerSideSamplingStore.getState().projectStats48h.data).toBe(undefined);
    expect(ServerSideSamplingStore.getState().projectStats30d.data).toBe(undefined);
    expect(ServerSideSamplingStore.getState().distribution.data).toBe(undefined);
    expect(ServerSideSamplingStore.getState().sdkVersions.data).toBe(undefined);
  });

  it('does not let user add without permissions', async function () {
    const {organization, router, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule],
          },
        }),
      ],
      access: [],
    });

    const mockRequests = renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: project.slug,
    });

    render(
      <TestComponent organization={organization} project={project} router={router} />
    );

    expect(screen.getByRole('button', {name: 'Add Rule'})).toBeDisabled();
    userEvent.hover(screen.getByText('Add Rule'));
    expect(
      await screen.findByText("You don't have permission to add a rule")
    ).toBeInTheDocument();

    expect(mockRequests.distribution).not.toHaveBeenCalled();
    expect(mockRequests.sdkVersions).not.toHaveBeenCalled();
  });

  it('does not let the user activate a rule if sdk updates exists', async function () {
    const {organization, router, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule, specificRule],
          },
        }),
      ],
    });

    renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: project.slug,
    });

    render(
      <TestComponent organization={organization} project={project} router={router} />
    );

    await screen.findByTestId('recommended-sdk-upgrades-alert');

    expect(screen.getByRole('checkbox', {name: 'Activate Rule'})).toBeDisabled();

    userEvent.hover(screen.getByLabelText('Activate Rule'));

    expect(
      await screen.findByText(
        'To enable the rule, the recommended sdk version have to be updated'
      )
    ).toBeInTheDocument();
  });
});
