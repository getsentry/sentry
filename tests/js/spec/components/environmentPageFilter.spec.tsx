import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import GlobalSelectionStore from 'sentry/stores/globalSelectionStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('EnvironmentPageFilter', function () {
  const {organization, router, routerContext} = initializeOrg({
    organization: {features: ['global-views']},
    project: undefined,
    projects: [
      {
        id: 2,
        slug: 'project-2',
        environments: ['prod', 'staging'],
      },
    ],
    router: {
      location: {query: {}},
      params: {orgId: 'org-slug'},
    },
  });
  OrganizationStore.onUpdate(organization, {replace: true});
  ProjectsStore.loadInitialData(organization.projects);
  GlobalSelectionStore.onInitializeUrlState({
    projects: [2],
    environments: [],
    datetime: {start: null, end: null, period: '14d', utc: null},
  });

  it('can pick environment', function () {
    mountWithTheme(
      <OrganizationContext.Provider value={organization}>
        <EnvironmentPageFilter />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );

    // Open the environment dropdown
    expect(screen.getByText('All Environments')).toBeInTheDocument();
    userEvent.click(screen.getByText('All Environments'));

    // Click the first environment's checkbox
    const envOptions = screen.getAllByTestId('checkbox-fancy');
    userEvent.click(envOptions[0]);

    // Close the dropdown
    userEvent.click(screen.getAllByText('prod')[0]);

    // Verify we were redirected
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: ['prod']}})
    );
  });
});
