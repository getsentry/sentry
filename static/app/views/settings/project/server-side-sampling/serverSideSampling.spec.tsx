import {InjectedRouter} from 'react-router';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {Organization, Project} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import ServerSideSampling from 'sentry/views/settings/project/server-side-sampling';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';
import * as useDistributionImport from 'sentry/views/settings/project/server-side-sampling/utils/useDistribution';
import * as useProjectStatsImport from 'sentry/views/settings/project/server-side-sampling/utils/useProjectStats';
import * as useSdkVersionsImport from 'sentry/views/settings/project/server-side-sampling/utils/useSdkVersions';

import {samplingBreakdownTitle} from './samplingBreakdown.spec';
import {
  getMockInitializeOrg,
  mockedProjects,
  mockedSamplingDistribution,
  mockedSamplingSdkVersions,
  specificRule,
  uniformRule,
} from './testUtils';

jest.spyOn(useDistributionImport, 'useDistribution').mockImplementation(() => ({
  loading: false,
  error: false,
  data: mockedSamplingDistribution,
}));

jest.spyOn(useSdkVersionsImport, 'useSdkVersions').mockImplementation(() => ({
  loading: false,
  error: false,
  data: mockedSamplingSdkVersions,
}));

jest.spyOn(useProjectStatsImport, 'useProjectStats').mockImplementation(() => ({
  projectStats30d: {loading: false, error: false, data: TestStubs.Outcomes()},
  projectStats48h: {loading: false, error: false, data: TestStubs.Outcomes()},
  onRefetch: jest.fn(),
}));

function ComponentProviders({
  router,
  project,
  organization,
  withModal,
  children,
}: {
  children: React.ReactNode;
  organization: Organization;
  project: Project;
  router: InjectedRouter;
  withModal?: boolean;
}) {
  const client = new QueryClient();

  return (
    <QueryClientProvider client={client}>
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
        {withModal && <GlobalModal />}
        <OrganizationContext.Provider value={organization}>
          {children}
        </OrganizationContext.Provider>
      </RouteContext.Provider>
    </QueryClientProvider>
  );
}

function renderMockRequests({
  organizationSlug,
  projectSlug,
}: {
  organizationSlug: Organization['slug'];
  projectSlug: Project['slug'];
}) {
  const projects = MockApiClient.addMockResponse({
    url: `/organizations/${organizationSlug}/projects/`,
    method: 'GET',
    body: mockedSamplingDistribution.project_breakdown!.map(p =>
      TestStubs.Project({id: p.project_id, slug: p.project})
    ),
  });

  const statsV2 = MockApiClient.addMockResponse({
    url: `/organizations/${organizationSlug}/stats_v2/`,
    method: 'GET',
    body: TestStubs.Outcomes(),
  });

  const distribution = MockApiClient.addMockResponse({
    url: `/projects/${organizationSlug}/${projectSlug}/dynamic-sampling/distribution/`,
    method: 'GET',
    body: mockedSamplingDistribution,
  });

  const sdkVersions = MockApiClient.addMockResponse({
    url: `/organizations/${organizationSlug}/dynamic-sampling/sdk-versions/`,
    method: 'GET',
    body: mockedSamplingSdkVersions,
  });

  return {projects, statsV2, distribution, sdkVersions};
}

describe('Server-Side Sampling', function () {
  it.skip('renders onboarding promo', async function () {
    const {router, organization, project} = getMockInitializeOrg();

    const mockRequests = renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: project.slug,
    });

    const {container} = render(
      <ComponentProviders router={router} organization={organization} project={project}>
        <ServerSideSampling project={project} />
      </ComponentProviders>
    );

    expect(
      await screen.findByRole('heading', {name: /Dynamic Sampling/})
    ).toBeInTheDocument();

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
    userEvent.click(await screen.findByRole('button', {name: 'Start Setup'}));

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
    const {router, organization, project} = getMockInitializeOrg({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [{...uniformRule, sampleRate: 1}],
          },
        }),
      ],
    });

    renderMockRequests({organizationSlug: organization.slug, projectSlug: project.slug});

    const {container} = render(
      <ComponentProviders router={router} organization={organization} project={project}>
        <ServerSideSampling project={project} />
      </ComponentProviders>
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
    const {router, organization, project} = getMockInitializeOrg({
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

    renderMockRequests({organizationSlug: organization.slug, projectSlug: project.slug});

    render(
      <ComponentProviders router={router} organization={organization} project={project}>
        <ServerSideSampling project={project} />
      </ComponentProviders>
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
    const {organization, projects, router} = getMockInitializeOrg({
      projects: mockedProjects,
    });

    renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: projects[2].slug,
    });

    render(
      <ComponentProviders
        router={router}
        organization={organization}
        project={projects[2]}
        withModal
      >
        <ServerSideSampling project={projects[2]} />
      </ComponentProviders>
    );

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

    expect(await screen.findByRole('heading', {name: 'Next steps'})).toBeInTheDocument();
  });

  it('does not let user add without permissions', async function () {
    const {organization, router, project} = getMockInitializeOrg({
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
      <ComponentProviders router={router} organization={organization} project={project}>
        <ServerSideSampling project={project} />
      </ComponentProviders>
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
    const {organization, router, project} = getMockInitializeOrg({
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
      <ComponentProviders router={router} organization={organization} project={project}>
        <ServerSideSampling project={project} />
      </ComponentProviders>
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

  it.skip('open uniform rate modal when editing a uniform rule', async function () {
    const {organization, router, project} = getMockInitializeOrg({
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

    render(
      <ComponentProviders
        router={router}
        organization={organization}
        project={project}
        withModal
      >
        <ServerSideSampling project={project} />
      </ComponentProviders>
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
    const {organization, router, project} = getMockInitializeOrg({
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
      <ComponentProviders
        router={router}
        organization={organization}
        project={project}
        withModal
      >
        <ServerSideSampling project={project} />
      </ComponentProviders>
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
