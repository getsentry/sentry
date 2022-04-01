import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import Onboarding from 'sentry/views/onboarding/targetedOnboarding/onboarding';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('Onboarding', function () {
  it('renders the welcome page', function () {
    const {organization, router, routerContext} = initializeOrg({
      router: {
        params: {
          step: 'welcome',
        },
      },
    });
    render(
      <OrganizationContext.Provider value={organization}>
        <Onboarding {...router} />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );
    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite Team')).toBeInTheDocument();
  });
  it('renders the setup docs step', function () {
    const projects = [
      TestStubs.Project({platform: 'javascript-nextjs', id: '4'}),
      TestStubs.Project({platform: 'ruby', id: '5'}),
    ];
    const {organization, router, routerContext} = initializeOrg({
      projects,
      router: {
        params: {
          step: 'setup-docs',
        },
      },
    });
    ProjectsStore.loadInitialData(projects);
    render(
      <OrganizationContext.Provider value={organization}>
        <Onboarding {...router} />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );
    expect(screen.getAllByTestId('sidebar-error-indicator')).toHaveLength(2);
  });
  it('renders the select platform step', function () {
    const {organization, router, routerContext} = initializeOrg({
      router: {
        params: {
          step: 'select-platform',
        },
      },
    });
    render(
      <OrganizationContext.Provider value={organization}>
        <Onboarding {...router} />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );
    expect(screen.getByText('Select all your projects platform')).toBeInTheDocument();
  });
});
