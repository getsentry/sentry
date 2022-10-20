import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';

import DynamicSampling from '.';

const ORG_FEATURES = [
  'server-side-sampling',
  'server-side-sampling-ui',
  'dynamic-sampling-opinionated',
];

describe('Dynamic Sampling', function () {
  it('renders default ui', function () {
    const {project, organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        features: ORG_FEATURES,
      },
    });

    render(
      <OrganizationContext.Provider value={organization}>
        <DynamicSampling project={project} />
      </OrganizationContext.Provider>
    );

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
      organization: {
        ...initializeOrg().organization,
        features: ORG_FEATURES,
        access: [],
      },
    });

    render(
      <OrganizationContext.Provider value={organization}>
        <DynamicSampling project={project} />
      </OrganizationContext.Provider>
    );

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
      organization: {
        ...initializeOrg().organization,
        features: ORG_FEATURES,
      },
    });

    render(
      <OrganizationContext.Provider value={organization}>
        <DynamicSampling project={project} />
      </OrganizationContext.Provider>
    );

    userEvent.click(screen.getByRole('checkbox', {name: 'Prioritize new releases'}));

    expect(
      screen.getByRole('checkbox', {
        name: 'Prioritize new releases',
      })
    ).not.toBeChecked();
  });
});
