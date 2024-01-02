import {browserHistory} from 'react-router';
import {GitHubIntegration as GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

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
import {trackAnalytics} from 'sentry/utils/analytics';
import OrganizationGeneralSettings from 'sentry/views/settings/organizationGeneralSettings';

jest.mock('sentry/utils/analytics');

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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/?provider_key=github`,
      method: 'GET',
      body: [GitHubIntegrationFixture()],
    });
  });

  it('can enable "early adopter"', async function () {
    render(<OrganizationGeneralSettings {...defaultProps} />);
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    await userEvent.click(screen.getByRole('checkbox', {name: /early adopter/i}));

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {isEarlyAdopter: true},
        })
      );
    });
  });

  it('can enable "codecov access"', async function () {
    const organizationWithCodecovFeature = Organization({
      features: ['codecov-integration'],
      codecovAccess: false,
    });
    render(
      <OrganizationGeneralSettings
        {...defaultProps}
        organization={organizationWithCodecovFeature}
      />,
      {organization: organizationWithCodecovFeature}
    );
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    await userEvent.click(
      screen.getByRole('checkbox', {name: /Enable Code Coverage Insights/i})
    );

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {codecovAccess: true},
        })
      );
    });

    expect(trackAnalytics).toHaveBeenCalled();
  });

  it('changes org slug and redirects to new slug', async function () {
    render(<OrganizationGeneralSettings {...defaultProps} />);
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      body: {...organization, slug: 'new-slug'},
    });

    await userEvent.clear(screen.getByRole('textbox', {name: /slug/i}));
    await userEvent.type(screen.getByRole('textbox', {name: /slug/i}), 'new-slug');

    await userEvent.click(screen.getByLabelText('Save'));

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

  it('changes org slug and redirects to new customer-domain', async function () {
    const org = Organization({features: ['customer-domains']});
    const updateMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {...org, slug: 'acme', links: {organizationUrl: 'https://acme.sentry.io'}},
    });

    render(<OrganizationGeneralSettings {...defaultProps} organization={org} />);

    const input = screen.getByRole('textbox', {name: /slug/i});

    await userEvent.clear(input);
    await userEvent.type(input, 'acme');

    await userEvent.click(screen.getByLabelText('Save'));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        '/organizations/org-slug/',
        expect.objectContaining({
          data: {
            slug: 'acme',
          },
        })
      );
      expect(window.location.replace).toHaveBeenCalledWith(
        'https://acme.sentry.io/settings/organization/'
      );
    });
  });

  it('disables the entire form if user does not have write access', function () {
    const readOnlyOrg = Organization({access: ['org:read']});

    render(<OrganizationGeneralSettings {...defaultProps} organization={readOnlyOrg} />, {
      organization: readOnlyOrg,
    });

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
        organization={Organization({
          access: ['org:write'],
        })}
      />
    );

    expect(
      screen.queryByRole('button', {name: /remove organization/i})
    ).not.toBeInTheDocument();
  });

  it('can remove organization when org admin', async function () {
    act(() => ProjectsStore.loadInitialData([ProjectFixture({slug: 'project'})]));

    render(
      <OrganizationGeneralSettings
        {...defaultProps}
        organization={Organization({access: ['org:admin']})}
      />
    );
    renderGlobalModal();

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
    });

    await userEvent.click(screen.getByRole('button', {name: /remove organization/i}));

    const modal = screen.getByRole('dialog');

    expect(
      within(modal).getByText('This will also remove the following associated projects:')
    ).toBeInTheDocument();
    expect(within(modal).getByText('project')).toBeInTheDocument();

    await userEvent.click(
      within(modal).getByRole('button', {name: /remove organization/i})
    );

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
