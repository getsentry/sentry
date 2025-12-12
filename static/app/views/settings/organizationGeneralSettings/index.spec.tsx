import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Config} from 'sentry/types/system';
import {trackAnalytics} from 'sentry/utils/analytics';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import OrganizationGeneralSettings from 'sentry/views/settings/organizationGeneralSettings';

jest.mock('sentry/utils/analytics');

describe('OrganizationGeneralSettings', () => {
  const ENDPOINT = '/organizations/org-slug/';
  const organization = OrganizationFixture();
  let configState: Config;
  let membersRequest: jest.Mock;

  beforeEach(() => {
    configState = ConfigStore.getState();
    OrganizationsStore.addOrReplace(organization);
    OrganizationStore.onUpdate(organization, {replace: true});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/?provider_key=github`,
      method: 'GET',
      body: [GitHubIntegrationFixture()],
    });
    membersRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
  });

  afterEach(() => {
    act(() => {
      ConfigStore.loadInitialData(configState);
    });
  });

  it('can enable "early adopter"', async () => {
    render(<OrganizationGeneralSettings />, {
      organization,
    });
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

  it('can enable "codecov access"', async () => {
    const organizationWithCodecovFeature = OrganizationFixture({
      features: ['codecov-integration'],
      codecovAccess: false,
    });
    OrganizationStore.onUpdate(organizationWithCodecovFeature, {replace: true});
    render(<OrganizationGeneralSettings />, {
      organization: organizationWithCodecovFeature,
    });
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

  it('changes org slug and redirects to new slug', async () => {
    const {router} = render(<OrganizationGeneralSettings />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/`,
        },
        route: '/settings/:orgId/',
      },
    });
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
    });
    await waitFor(() => {
      expect(router.location.pathname).toBe('/settings/new-slug/');
    });
  });

  it('changes org slug and redirects to new customer-domain', async () => {
    ConfigStore.set('features', new Set(['system:multi-region']));

    const org = OrganizationFixture();
    OrganizationStore.onUpdate(org, {replace: true});
    const updateMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {...org, slug: 'acme', links: {organizationUrl: 'https://acme.sentry.io'}},
    });

    render(<OrganizationGeneralSettings />, {
      organization: org,
    });

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
    });
    expect(testableWindowLocation.replace).toHaveBeenCalledWith(
      'https://acme.sentry.io/settings/organization/'
    );
  });

  it('disables the entire form if user does not have write access', async () => {
    const readOnlyOrg = OrganizationFixture({access: ['org:read']});
    OrganizationStore.onUpdate(readOnlyOrg, {replace: true});

    render(<OrganizationGeneralSettings />, {
      organization: readOnlyOrg,
    });

    await waitFor(() => expect(membersRequest).toHaveBeenCalled());

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

  it('does not have remove organization button without org:admin permission', async () => {
    const orgWithWriteAccess = OrganizationFixture({access: ['org:write']});
    OrganizationStore.onUpdate(orgWithWriteAccess, {replace: true});

    render(<OrganizationGeneralSettings />, {
      organization: orgWithWriteAccess,
    });

    await waitFor(() => expect(membersRequest).toHaveBeenCalled());

    expect(
      screen.queryByRole('button', {name: /remove organization/i})
    ).not.toBeInTheDocument();
  });

  it('can remove organization when org admin', async () => {
    const orgWithAdminAccess = OrganizationFixture({access: ['org:admin']});
    OrganizationStore.onUpdate(orgWithAdminAccess, {replace: true});
    act(() => ProjectsStore.loadInitialData([ProjectFixture({slug: 'project'})]));

    render(<OrganizationGeneralSettings />, {
      organization: orgWithAdminAccess,
    });
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
