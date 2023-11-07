import selectEvent from 'react-select-event';
import {Organization} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationCreate from 'sentry/views/organizationCreate';

describe('OrganizationCreate', function () {
  let oldRegions: any[] = [];
  beforeEach(() => {
    ConfigStore.get('termsUrl');
    ConfigStore.get('privacyUrl');

    oldRegions = ConfigStore.get('regions');

    // Set only a single region in the config store by default
    ConfigStore.set('regions', [{name: '--monolith--', url: 'https://example.com'}]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    ConfigStore.set('regions', oldRegions);
  });

  it('renders without terms', function () {
    render(<OrganizationCreate />);
  });

  it('renders with terms', function () {
    ConfigStore.set('termsUrl', 'https://example.com/terms');
    ConfigStore.set('privacyUrl', 'https://example.com/privacy');
    render(<OrganizationCreate />);
  });

  it('creates a new org', async function () {
    const orgCreateMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      method: 'POST',
      body: Organization(),
    });
    ConfigStore.set('termsUrl', 'https://example.com/terms');
    ConfigStore.set('privacyUrl', 'https://example.com/privacy');
    render(<OrganizationCreate />);
    expect(screen.getByText('Create a New Organization')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'I agree to the Terms of Service and the Privacy Policy',
      })
    );
    await userEvent.click(screen.getByText('Create Organization'));

    await waitFor(() => {
      expect(orgCreateMock).toHaveBeenCalledWith('/organizations/', {
        success: expect.any(Function),
        error: expect.any(Function),
        method: 'POST',
        data: {agreeTerms: true, defaultTeam: true, name: 'Good Burger'},
        host: undefined,
      });
    });
    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(
      '/organizations/org-slug/projects/new/'
    );
  });

  it('creates a new org with customer domain feature', async function () {
    const orgCreateMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      method: 'POST',
      body: Organization({
        features: ['customer-domains'],
      }),
    });
    ConfigStore.set('termsUrl', 'https://example.com/terms');
    ConfigStore.set('privacyUrl', 'https://example.com/privacy');
    render(<OrganizationCreate />);
    expect(screen.getByText('Create a New Organization')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'I agree to the Terms of Service and the Privacy Policy',
      })
    );
    await userEvent.click(screen.getByText('Create Organization'));

    await waitFor(() => {
      expect(orgCreateMock).toHaveBeenCalledWith('/organizations/', {
        data: {agreeTerms: true, defaultTeam: true, name: 'Good Burger'},
        method: 'POST',
        success: expect.any(Function),
        error: expect.any(Function),
        host: undefined,
      });
    });

    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/'
    );
  });

  function multiRegionSetup() {
    const orgCreateMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      method: 'POST',
      body: Organization({
        features: ['customer-domains'],
      }),
    });

    ConfigStore.set('features', new Set(['organizations:multi-region-selector']));
    ConfigStore.set('regions', [
      {url: 'https://us.example.com', name: 'us'},
      {
        url: 'https://de.example.com',
        name: 'de',
      },
    ]);

    return orgCreateMock;
  }

  it('renders without region data and submits without host when only a single region is defined', async function () {
    const orgCreateMock = multiRegionSetup();
    // Set only a single region in the config store
    ConfigStore.set('regions', [{name: '--monolith--', url: 'https://example.com'}]);

    render(<OrganizationCreate />);
    expect(screen.queryByLabelText('Data Storage')).not.toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    await userEvent.click(screen.getByText('Create Organization'));

    await waitFor(() => {
      expect(orgCreateMock).toHaveBeenCalledWith('/organizations/', {
        success: expect.any(Function),
        error: expect.any(Function),
        method: 'POST',
        host: undefined,
        data: {defaultTeam: true, name: 'Good Burger'},
      });
    });

    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/'
    );
  });

  it('renders with region data and selects US region as default when the feature flag is enabled', async function () {
    const orgCreateMock = multiRegionSetup();
    render(<OrganizationCreate />);
    expect(screen.getByLabelText('Data Storage')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    await userEvent.click(screen.getByText('Create Organization'));

    const expectedHost = 'https://us.example.com';
    await waitFor(() => {
      expect(orgCreateMock).toHaveBeenCalledWith('/organizations/', {
        success: expect.any(Function),
        error: expect.any(Function),
        method: 'POST',
        host: expectedHost,
        data: {defaultTeam: true, name: 'Good Burger'},
      });
    });

    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/'
    );
  });

  it('renders without region data and submits without host when the feature flag is not enabled', async function () {
    const orgCreateMock = multiRegionSetup();
    ConfigStore.set('features', new Set());
    render(<OrganizationCreate />);
    expect(screen.queryByLabelText('Data Storage')).not.toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    await userEvent.click(screen.getByText('Create Organization'));

    await waitFor(() => {
      expect(orgCreateMock).toHaveBeenCalledWith('/organizations/', {
        success: expect.any(Function),
        error: expect.any(Function),
        method: 'POST',
        host: undefined,
        data: {defaultTeam: true, name: 'Good Burger'},
      });
    });

    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/'
    );
  });

  it('uses the host of the selected region when submitting', async function () {
    const orgCreateMock = multiRegionSetup();
    render(<OrganizationCreate />);
    expect(screen.getByLabelText('Data Storage')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Data Storage'}),
      '🇪🇺 European Union (EU)'
    );
    await userEvent.click(screen.getByText('Create Organization'));

    const expectedHost = 'https://de.example.com';
    await waitFor(() => {
      expect(orgCreateMock).toHaveBeenCalledWith('/organizations/', {
        success: expect.any(Function),
        error: expect.any(Function),
        method: 'POST',
        host: expectedHost,
        data: {defaultTeam: true, name: 'Good Burger'},
      });
    });

    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/'
    );
  });
});
