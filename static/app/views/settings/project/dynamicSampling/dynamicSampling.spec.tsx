import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Organization, Project} from 'sentry/types';
import {DynamicSamplingBiasType} from 'sentry/types/sampling';

import DynamicSampling from '.';

const ORG_FEATURES = [
  'server-side-sampling',
  'dynamic-sampling-deprecated',
  'dynamic-sampling',
];

const dynamicSamplingBiases = [
  {id: DynamicSamplingBiasType.BOOST_LATEST_RELEASES, active: true},
  {id: DynamicSamplingBiasType.BOOST_ENVIRONMENTS, active: true},
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
  it('renders default ui', function () {
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

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);

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

    const ignoreHealthChecks = screen.getByRole('checkbox', {
      name: 'Ignore health checks',
    });

    expect(ignoreHealthChecks).toBeEnabled();
    expect(ignoreHealthChecks).toBeChecked();
  });

  it('renders disabled default UI, when user has not permission to edit', function () {
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

    expect(screen.getAllByTestId('more-information')).toHaveLength(3);

    const prioritizenewReleases = screen.getByRole('checkbox', {
      name: 'Prioritize new releases',
    });

    expect(prioritizenewReleases).toBeDisabled();
    expect(prioritizenewReleases).toBeChecked();

    const prioritizeDevEnvironments = screen.getByRole('checkbox', {
      name: 'Prioritize dev environments',
    });

    expect(prioritizeDevEnvironments).toBeDisabled();
    expect(prioritizeDevEnvironments).toBeChecked();

    const ignoreHealthChecks = screen.getByRole('checkbox', {
      name: 'Ignore health checks',
    });

    expect(ignoreHealthChecks).toBeDisabled();
    expect(ignoreHealthChecks).toBeChecked();
  });

  it('user can toggle option', function () {
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

    userEvent.click(screen.getByRole('checkbox', {name: 'Prioritize new releases'}));

    expect(mockRequests.projectDetails).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/`,
      expect.objectContaining({
        data: {
          dynamicSamplingBiases: [
            {id: DynamicSamplingBiasType.BOOST_LATEST_RELEASES, active: false},
            {id: DynamicSamplingBiasType.BOOST_ENVIRONMENTS, active: true},
            {id: DynamicSamplingBiasType.IGNORE_HEALTH_CHECKS, active: true},
          ],
        },
      })
    );
  });
});
