import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import OrganizationsStore from 'sentry/stores/organizationsStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import OrganizationGeneralSettings from 'sentry/views/settings/organizationGeneralSettings';

describe('OrganizationGeneralSettings', function () {
  const ENDPOINT = '/organizations/org-slug/';
  const {organization, router} = initializeOrg();

  const defaultProps = {
    organization,
    router,
    location: router.location,
    params: {orgId: organization.slug},
    routes: router.routes,
    route: {},
    routeParams: router.params,
  };

  beforeEach(function () {
    OrganizationsStore.addOrReplace(organization);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
    });
  });

  it('can enable "early adopter"', async function () {
    render(<OrganizationGeneralSettings {...defaultProps} />);
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    userEvent.click(screen.getByRole('checkbox', {name: /early adopter/i}));

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {isEarlyAdopter: true},
        })
      );
    });
  });

  it('changes org slug and redirects to new slug', async function () {
    render(<OrganizationGeneralSettings {...defaultProps} />);
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    userEvent.clear(screen.getByRole('textbox', {name: /slug/i}));
    userEvent.type(screen.getByRole('textbox', {name: /slug/i}), 'new-slug');

    userEvent.click(screen.getByLabelText('Save'));

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {slug: 'new-slug'},
        })
      );
      expect(browserHistory.replace).toHaveBeenCalledWith('/settings/new-slug/');
    });
  });

  it('disables the entire form if user does not have write access', function () {
    render(
      <OrganizationGeneralSettings
        {...defaultProps}
        organization={TestStubs.Organization({access: ['org:read']})}
      />
    );

    const formElements = [
      ...screen.getAllByRole('textbox'),
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('checkbox'),
    ];

    for (const formElement of formElements) {
      expect(formElement).toBeDisabled();
    }

    expect(
      screen.getByText(
        'These settings can only be edited by users with the organization owner or manager role.'
      )
    ).toBeInTheDocument();
  });

  it('does not have remove organization button without org:admin permission', function () {
    render(
      <OrganizationGeneralSettings
        {...defaultProps}
        organization={TestStubs.Organization({
          access: ['org:write'],
        })}
      />
    );

    expect(
      screen.queryByRole('button', {name: /remove organization/i})
    ).not.toBeInTheDocument();
  });

  it('can remove organization when org admin', async function () {
    act(() => ProjectsStore.loadInitialData([TestStubs.Project({slug: 'project'})]));

    render(
      <OrganizationGeneralSettings
        {...defaultProps}
        organization={TestStubs.Organization({access: ['org:admin']})}
      />
    );
    renderGlobalModal();

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
    });

    userEvent.click(screen.getByRole('button', {name: /remove organization/i}));

    const modal = screen.getByRole('dialog');

    expect(
      within(modal).getByText('This will also remove the following associated projects:')
    ).toBeInTheDocument();
    expect(within(modal).getByText('project')).toBeInTheDocument();

    userEvent.click(within(modal).getByRole('button', {name: /remove organization/i}));

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});
