import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Organization, Project} from 'sentry/types';
import {DynamicSamplingBiasType} from 'sentry/types/sampling';

import DynamicSampling from '.';

const ORG_FEATURES = ['dynamic-sampling'];

const dynamicSamplingBiases = [
  {id: DynamicSamplingBiasType.BOOST_LATEST_RELEASES, active: true},
  {id: DynamicSamplingBiasType.BOOST_ENVIRONMENTS, active: true},
  {id: DynamicSamplingBiasType.BOOST_KEY_TRANSACTIONS, active: true},
  {id: DynamicSamplingBiasType.IGNORE_HEALTH_CHECKS, active: true},
];

function renderMockRequests(
  organizationSlug: Organization['slug'],
  projectSlug: Project['slug']
) {
  const projectDetails = MockApiClient.addMockResponse({
    url: `/projects/${organizationSlug}/${projectSlug}/`,
    method: 'PUT',
    body: {},
  });

  return {projectDetails};
}

describe('Dynamic Sampling', function () {
  it('renders default ui', async function () {
    const {project, organization} = initializeOrg({
      ...initializeOrg(),
      projects: [
        TestStubs.Project({
          dynamicSamplingBiases,
        }),
      ],
      organization: {
        ...initializeOrg().organization,
        features: ORG_FEATURES,
      },
    });

    renderMockRequests(organization.slug, project.slug);

    render(<DynamicSampling project={project} />, {organization});

    expect(screen.getByRole('heading', {name: /Dynamic Sampling/})).toBeInTheDocument();

    expect(screen.getAllByRole('checkbox')).toHaveLength(4);

    expect(screen.queryByTestId('more-information')).not.toBeInTheDocument();

    const prioritizenewReleases = screen.getByRole('checkbox', {
      name: 'Prioritize new releases',
    });

    expect(prioritizenewReleases).toBeEnabled();
    expect(prioritizenewReleases).toBeChecked();

    const prioritizeDevEnvironments = screen.getByRole('checkbox', {
      name: 'Prioritize dev environments',
    });

    expect(prioritizeDevEnvironments).toBeEnabled();
    expect(prioritizeDevEnvironments).toBeChecked();

    const prioritizeKeyTransactions = screen.getByRole('checkbox', {
      name: 'Prioritize key transactions',
    });

    expect(prioritizeKeyTransactions).toBeEnabled();
    expect(prioritizeKeyTransactions).toBeChecked();

    const deprioritizeHealthChecks = screen.getByRole('checkbox', {
      name: 'Deprioritize health checks',
    });

    expect(deprioritizeHealthChecks).toBeEnabled();
    expect(deprioritizeHealthChecks).toBeChecked();

    // Prioritize low-volume transactions is not available
    expect(
      screen.queryByRole('checkbox', {name: 'Prioritize low-volume transactions'})
    ).not.toBeInTheDocument();
  });

  it('renders disabled default UI, async when user has not permission to edit', async function () {
    const {project, organization} = initializeOrg({
      ...initializeOrg(),
      projects: [
        TestStubs.Project({
          dynamicSamplingBiases,
        }),
      ],
      organization: {
        ...initializeOrg().organization,
        features: ORG_FEATURES,
        access: [],
      },
    });

    renderMockRequests(organization.slug, project.slug);

    render(<DynamicSampling project={project} />, {organization});

    expect(
      screen.getByText(
        /These settings can only be edited by users with the organization owner, manager, or admin role/
      )
    ).toBeInTheDocument();

    const prioritizenewReleases = screen.getByRole('checkbox', {
      name: 'Prioritize new releases',
    });

    expect(prioritizenewReleases).toBeDisabled();
    expect(prioritizenewReleases).toBeChecked();
    await userEvent.hover(prioritizenewReleases);
    expect(
      await screen.findByText('You do not have permission to edit this setting')
    ).toBeInTheDocument();

    const prioritizeDevEnvironments = screen.getByRole('checkbox', {
      name: 'Prioritize dev environments',
    });

    expect(prioritizeDevEnvironments).toBeDisabled();
    expect(prioritizeDevEnvironments).toBeChecked();

    const prioritizeKeyTransactions = screen.getByRole('checkbox', {
      name: 'Prioritize key transactions',
    });

    expect(prioritizeKeyTransactions).toBeDisabled();
    expect(prioritizeKeyTransactions).toBeChecked();

    const deprioritizeHealthChecks = screen.getByRole('checkbox', {
      name: 'Deprioritize health checks',
    });

    expect(deprioritizeHealthChecks).toBeDisabled();
    expect(deprioritizeHealthChecks).toBeChecked();
  });

  it('user can toggle option', async function () {
    const {project, organization} = initializeOrg({
      ...initializeOrg(),
      projects: [
        TestStubs.Project({
          dynamicSamplingBiases,
        }),
      ],
      organization: {
        ...initializeOrg().organization,
        features: ORG_FEATURES,
      },
    });

    const mockRequests = renderMockRequests(organization.slug, project.slug);

    render(<DynamicSampling project={project} />, {organization});

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Prioritize new releases'})
    );

    expect(mockRequests.projectDetails).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/`,
      expect.objectContaining({
        data: {
          dynamicSamplingBiases: [
            {id: DynamicSamplingBiasType.BOOST_LATEST_RELEASES, active: false},
            {id: DynamicSamplingBiasType.BOOST_ENVIRONMENTS, active: true},
            {id: DynamicSamplingBiasType.BOOST_KEY_TRANSACTIONS, active: true},
            {id: DynamicSamplingBiasType.IGNORE_HEALTH_CHECKS, active: true},
          ],
        },
      })
    );
  });

  it('render and toggle "Prioritize low-volume transactions" option', async function () {
    const {project, organization} = initializeOrg({
      ...initializeOrg(),
      projects: [
        TestStubs.Project({
          dynamicSamplingBiases: [
            ...dynamicSamplingBiases,
            {id: DynamicSamplingBiasType.BOOST_LOW_VOLUME_TRANSACTIONS, active: false},
          ],
        }),
      ],
      organization: {
        ...initializeOrg().organization,
        features: [...ORG_FEATURES, 'dynamic-sampling-transaction-name-priority'],
      },
    });

    const mockRequests = renderMockRequests(organization.slug, project.slug);

    render(<DynamicSampling project={project} />, {organization});

    const prioritizeTransactionNames = screen.getByRole('checkbox', {
      name: 'Prioritize low-volume transactions',
    });

    expect(prioritizeTransactionNames).toBeEnabled();
    expect(prioritizeTransactionNames).not.toBeChecked();

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Prioritize low-volume transactions'})
    );

    expect(mockRequests.projectDetails).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/`,
      expect.objectContaining({
        data: {
          dynamicSamplingBiases: [
            {id: DynamicSamplingBiasType.BOOST_LATEST_RELEASES, active: true},
            {id: DynamicSamplingBiasType.BOOST_ENVIRONMENTS, active: true},
            {id: DynamicSamplingBiasType.BOOST_KEY_TRANSACTIONS, active: true},
            {id: DynamicSamplingBiasType.IGNORE_HEALTH_CHECKS, active: true},
            {id: DynamicSamplingBiasType.BOOST_LOW_VOLUME_TRANSACTIONS, active: true},
          ],
        },
      })
    );
  });
});
