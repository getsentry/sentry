import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ConfigStore} from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import OrganizationCreate, {
  DATA_STORAGE_DOCS_LINK,
} from 'sentry/views/organizationCreate';

describe('OrganizationCreate', () => {
  let configstate: Config;

  beforeEach(() => {
    ConfigStore.get('termsUrl');
    ConfigStore.get('privacyUrl');

    configstate = ConfigStore.getState();

    // Set only a single locality in the config store by default
    ConfigStore.set('localities', [{name: '--monolith--', url: 'https://example.com'}]);
    ConfigStore.set('signupLocalities', ['--monolith--']);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    ConfigStore.loadInitialData(configstate);
  });

  it('renders without terms', () => {
    render(<OrganizationCreate />);
  });

  it('renders with terms', () => {
    ConfigStore.set('termsUrl', 'https://example.com/terms');
    ConfigStore.set('privacyUrl', 'https://example.com/privacy');
    render(<OrganizationCreate />);
  });

  it('does not render relocation url for self-hosted', () => {
    ConfigStore.set('termsUrl', 'https://example.com/terms');
    ConfigStore.set('privacyUrl', 'https://example.com/privacy');
    ConfigStore.set('isSelfHosted', true);
    render(<OrganizationCreate />);

    expect(() =>
      screen.getByText('Relocating from self-hosted?', {exact: false})
    ).toThrow();
  });

  it('creates a new org', async () => {
    const orgCreateMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      host: ConfigStore.get('links').sentryUrl,
      method: 'POST',
      body: OrganizationFixture(),
    });
    ConfigStore.set('termsUrl', 'https://example.com/terms');
    ConfigStore.set('privacyUrl', 'https://example.com/privacy');
    ConfigStore.set('isSelfHosted', false);
    ConfigStore.set('features', new Set(['relocation:enabled']));
    render(<OrganizationCreate />);
    expect(screen.getByText('Create a New Organization')).toBeInTheDocument();
    expect(
      screen.getByText('Relocating from self-hosted?', {exact: false})
    ).toBeInTheDocument();
    expect(screen.getByText('Relocating from self-hosted?')).toHaveAttribute(
      'href',
      '/relocation/'
    );

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
        host: ConfigStore.get('links').sentryUrl,
      });
    });
    expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      '/organizations/org-slug/projects/new/?projectCreationOrigin=org_creation'
    );
  });

  it('creates a new org with customer domain feature', async () => {
    const orgCreateMock = MockApiClient.addMockResponse({
      host: ConfigStore.get('links').sentryUrl,
      url: '/organizations/',
      method: 'POST',
      body: OrganizationFixture(),
    });
    ConfigStore.set('features', new Set(['system:multi-region']));
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
        host: ConfigStore.get('links').sentryUrl,
      });
    });

    expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/?projectCreationOrigin=org_creation'
    );
  });

  function multiLocalitySetup() {
    const orgCreateMock = MockApiClient.addMockResponse({
      host: ConfigStore.get('links').sentryUrl,
      url: '/organizations/',
      method: 'POST',
      body: OrganizationFixture(),
    });

    ConfigStore.set('localities', [
      {url: 'https://us.example.com', name: 'us'},
      {
        url: 'https://de.example.com',
        name: 'de',
      },
    ]);
    ConfigStore.set('signupLocalities', ['us', 'de']);

    return orgCreateMock;
  }

  it('renders without region data and submits without host when only a single region is defined', async () => {
    const orgCreateMock = multiLocalitySetup();
    // Set only a single region in the config store
    ConfigStore.set('localities', [{name: '--monolith--', url: 'https://example.com'}]);
    ConfigStore.set('signupLocalities', ['--monolith--']);
    ConfigStore.set('features', new Set(['system:multi-region']));

    render(<OrganizationCreate />);
    expect(screen.queryByLabelText('Data Storage Location')).not.toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    await userEvent.click(screen.getByText('Create Organization'));

    await waitFor(() => {
      expect(orgCreateMock).toHaveBeenCalledWith('/organizations/', {
        success: expect.any(Function),
        error: expect.any(Function),
        method: 'POST',
        host: ConfigStore.get('links').sentryUrl,
        data: {defaultTeam: true, name: 'Good Burger'},
      });
    });

    expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/?projectCreationOrigin=org_creation'
    );
  });

  it('renders without a pre-selected region, and does not submit until one is selected', async () => {
    ConfigStore.set('features', new Set(['system:multi-region']));

    const orgCreateMock = multiLocalitySetup();
    render(<OrganizationCreate />);
    expect(screen.getByLabelText('Data Storage Location')).toBeInTheDocument();
    const link = screen.getByText<HTMLAnchorElement>('Learn More');
    expect(link).toBeInTheDocument();
    expect(link.href).toBe(DATA_STORAGE_DOCS_LINK);
    await userEvent.type(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    await userEvent.click(screen.getByText('Create Organization'));

    expect(orgCreateMock).not.toHaveBeenCalled();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Data Storage Location'}),
      '🇺🇸 United States of America (US)'
    );
    await userEvent.click(screen.getByText('Create Organization'));

    await waitFor(() => {
      expect(orgCreateMock).toHaveBeenCalledWith('/organizations/', {
        success: expect.any(Function),
        error: expect.any(Function),
        method: 'POST',
        host: ConfigStore.get('links').sentryUrl,
        data: {defaultTeam: true, name: 'Good Burger', dataStorageLocation: 'us'},
      });
    });

    expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/?projectCreationOrigin=org_creation'
    );
  });

  it('uses the host of the selected region when submitting', async () => {
    ConfigStore.set('features', new Set(['system:multi-region']));

    const orgCreateMock = multiLocalitySetup();
    render(<OrganizationCreate />);
    expect(screen.getByLabelText('Data Storage Location')).toBeInTheDocument();
    const link = screen.getByText<HTMLAnchorElement>('Learn More');
    expect(link).toBeInTheDocument();
    expect(link.href).toBe(DATA_STORAGE_DOCS_LINK);
    await userEvent.type(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Data Storage Location'}),
      '🇪🇺 European Union (EU)'
    );
    await userEvent.click(screen.getByText('Create Organization'));

    await waitFor(() => {
      expect(orgCreateMock).toHaveBeenCalledWith('/organizations/', {
        success: expect.any(Function),
        error: expect.any(Function),
        method: 'POST',
        host: ConfigStore.get('links').sentryUrl,
        data: {defaultTeam: true, name: 'Good Burger', dataStorageLocation: 'de'},
      });
    });

    expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/?projectCreationOrigin=org_creation'
    );
  });

  it('submits to the control URL when multi-region is active', async () => {
    ConfigStore.set('features', new Set(['system:multi-region']));
    ConfigStore.set('urlPrefix', 'https://sentry.io');
    ConfigStore.set('localities', [
      {url: 'https://us.example.com', name: 'us'},
      {
        url: 'https://de.example.com',
        name: 'de',
      },
    ]);
    ConfigStore.set('signupLocalities', ['us', 'de']);
    const orgCreateMock = MockApiClient.addMockResponse({
      host: ConfigStore.get('links').sentryUrl,
      url: '/organizations/',
      method: 'POST',
      body: OrganizationFixture(),
    });

    render(<OrganizationCreate />);
    expect(screen.getByLabelText('Data Storage Location')).toBeInTheDocument();
    const link = screen.getByText<HTMLAnchorElement>('Learn More');
    expect(link).toBeInTheDocument();
    expect(link.href).toBe(DATA_STORAGE_DOCS_LINK);
    await userEvent.type(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Data Storage Location'}),
      '🇪🇺 European Union (EU)'
    );
    await userEvent.click(screen.getByText('Create Organization'));

    await waitFor(() => {
      expect(orgCreateMock).toHaveBeenCalledWith('/organizations/', {
        success: expect.any(Function),
        error: expect.any(Function),
        method: 'POST',
        host: 'https://sentry.io',
        data: {defaultTeam: true, name: 'Good Burger', dataStorageLocation: 'de'},
      });
    });

    expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/?projectCreationOrigin=org_creation'
    );
  });
});
