import {
  createMemoryHistory,
  IndexRoute,
  Route,
  Router,
  RouterContext,
} from 'react-router';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {Organization, Project} from 'sentry/types';
import {SamplingSdkVersion} from 'sentry/types/sampling';
import {RouteContext} from 'sentry/views/routeContext';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';

import {samplingBreakdownTitle} from './samplingBreakdown.spec';
import {
  getMockData,
  mockedProjects,
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

describe('Server-Side Sampling', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders onboarding promo and open uniform rule modal', async function () {
    const {organization, project} = getMockData();

    const mockRequests = renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: project.slug,
    });

    const memoryHistory = createMemoryHistory();

    memoryHistory.push(
      `/settings/${organization.slug}/projects/${project.slug}/dynamic-sampling/`
    );

    function Component() {
      return <TestComponent organization={organization} project={project} withModal />;
    }

    const {container} = render(
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
          <IndexRoute component={Component} />
          <Route path="rules/:rule/" component={Component} />
        </Route>
      </Router>
    );

    expect(screen.getByRole('heading', {name: /Dynamic Sampling/})).toBeInTheDocument();

    expect(screen.getByText(/Improve the accuracy of your/)).toBeInTheDocument();

    // Assert that project breakdown is there
    expect(await screen.findByText(samplingBreakdownTitle)).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {name: 'Sample for relevancy'})
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Create rules to sample transactions under specific conditions, keeping what you need and dropping what you don’t.'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );

    // Open Modal
    userEvent.click(screen.getByRole('button', {name: 'Start Setup'}));

    expect(
      await screen.findByRole('heading', {name: 'Set a global sample rate'})
    ).toBeInTheDocument();

    expect(mockRequests.statsV2).toHaveBeenCalledTimes(2);
    expect(mockRequests.distribution).toHaveBeenCalledTimes(1);
    expect(mockRequests.sdkVersions).toHaveBeenCalledTimes(1);

    // Close Modal
    userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitForElementToBeRemoved(() => screen.getByRole('dialog'));

    expect(container).toSnapshot();
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
    expect(screen.getByLabelText('Activate Rule')).toBeInTheDocument();
    expect(screen.getByLabelText('Actions')).toBeInTheDocument();

    // Rule Panel Footer
    expect(screen.getByText('Add Rule')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );

    expect(container).toSnapshot();
  });

  it('does not let you delete the base rule', async function () {
    const {router, organization, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.2,
                type: 'trace',
                active: false,
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'trace.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 2,
              },
              {
                sampleRate: 0.2,
                type: 'trace',
                active: false,
                condition: {
                  op: 'and',
                  inner: [],
                },
                id: 1,
              },
            ],
            next_id: 3,
          },
        }),
      ],
    });

    renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: project.slug,
    });

    render(
      <TestComponent router={router} organization={organization} project={project} />
    );

    // Assert that project breakdown is there (avoids 'act' warnings)
    expect(await screen.findByText(samplingBreakdownTitle)).toBeInTheDocument();

    userEvent.click(screen.getAllByLabelText('Actions')[0]);
    expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toHaveAttribute(
      'aria-disabled',
      'false'
    );

    userEvent.click(screen.getAllByLabelText('Actions')[0]);
    userEvent.click(screen.getAllByLabelText('Actions')[1]);
    expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('display "update sdk versions" alert and open "recommended next step" modal', async function () {
    const {organization, projects, router} = getMockData({
      projects: mockedProjects,
    });

    const mockRequests = renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: projects[2].slug,
    });

    render(
      <TestComponent
        organization={organization}
        project={projects[2]}
        router={router}
        withModal
      />
    );

    expect(mockRequests.distribution).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockRequests.sdkVersions).toHaveBeenCalled();
    });

    const recommendedSdkUpgradesAlert = await screen.findByTestId(
      'recommended-sdk-upgrades-alert'
    );

    expect(
      within(recommendedSdkUpgradesAlert).getByText(
        'To activate sampling rules, it’s a requirement to update the following project SDK(s):'
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

    expect(
      await screen.findByRole('heading', {name: 'Important next steps'})
    ).toBeInTheDocument();
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
            rules: [uniformRule],
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

  it('does not let the user activate an uniform rule if still processing', async function () {
    const {organization, router, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule],
          },
        }),
      ],
    });

    renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: project.slug,
      mockedSdkVersionsResponse: [],
    });

    render(
      <TestComponent router={router} organization={organization} project={project} />
    );

    expect(await screen.findByRole('checkbox', {name: 'Activate Rule'})).toBeDisabled();

    userEvent.hover(screen.getByLabelText('Activate Rule'));

    expect(
      await screen.findByText(
        'We are processing sampling information for your project, so you cannot enable the rule yet. Please check again later'
      )
    ).toBeInTheDocument();
  });

  it('open uniform rate modal when editing a uniform rule', async function () {
    const {organization, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule],
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

    function Component() {
      return <TestComponent organization={organization} project={project} withModal />;
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
          <IndexRoute component={Component} />
          <Route path="rules/:rule/" component={Component} />
        </Route>
      </Router>
    );

    userEvent.click(await screen.findByLabelText('Actions'));

    // Open Modal
    userEvent.click(screen.getByLabelText('Edit'));

    expect(
      await screen.findByRole('heading', {name: 'Set a global sample rate'})
    ).toBeInTheDocument();

    expect(mockRequests.statsV2).toHaveBeenCalledTimes(2);
    expect(mockRequests.distribution).toHaveBeenCalledTimes(1);
    expect(mockRequests.sdkVersions).toHaveBeenCalledTimes(1);
  });

  it('does not let user reorder uniform rule', async function () {
    const {organization, router, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [specificRule, uniformRule],
          },
        }),
      ],
    });

    renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: project.slug,
    });

    render(
      <TestComponent
        organization={organization}
        project={project}
        router={router}
        withModal
      />
    );

    const samplingUniformRule = screen.getAllByTestId('sampling-rule')[1];

    expect(
      within(samplingUniformRule).getByRole('button', {name: 'Drag Rule'})
    ).toHaveAttribute('aria-disabled', 'true');

    userEvent.hover(within(samplingUniformRule).getByLabelText('Drag Rule'));

    expect(
      await screen.findByText('Uniform rules cannot be reordered')
    ).toBeInTheDocument();
  });
});
