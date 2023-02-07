import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationCreate from 'sentry/views/organizationCreate';

describe('OrganizationCreate', function () {
  beforeEach(() => {
    ConfigStore.get('termsUrl');
    ConfigStore.get('privacyUrl');
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
  });

  it('renders without terms', function () {
    const wrapper = render(<OrganizationCreate />);
    expect(wrapper.container).toSnapshot();
  });

  it('renders with terms', function () {
    ConfigStore.set('termsUrl', 'https://example.com/terms');
    ConfigStore.set('privacyUrl', 'https://example.com/privacy');
    const wrapper = render(<OrganizationCreate />);
    expect(wrapper.container).toSnapshot();
  });

  it('creates a new org', function () {
    const orgCreateMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      method: 'POST',
      body: TestStubs.Organization(),
    });
    ConfigStore.set('termsUrl', 'https://example.com/terms');
    ConfigStore.set('privacyUrl', 'https://example.com/privacy');
    render(<OrganizationCreate />);
    expect(screen.getByText('Create a New Organization')).toBeInTheDocument();

    userEvent.paste(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    userEvent.click(
      screen.getByRole('checkbox', {
        name: 'I agree to the Terms of Service and the Privacy Policy',
      })
    );
    userEvent.click(screen.getByText('Create Organization'));

    expect(orgCreateMock).toHaveBeenCalledWith(
      '/organizations/',
      expect.objectContaining({
        data: {agreeTerms: true, defaultTeam: true, name: 'Good Burger'},
      })
    );
    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(
      '/organizations/org-slug/projects/new/'
    );
  });

  it('creates a new org with customer domain feature', function () {
    const orgCreateMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      method: 'POST',
      body: TestStubs.Organization({
        features: ['customer-domains'],
      }),
    });
    ConfigStore.set('termsUrl', 'https://example.com/terms');
    ConfigStore.set('privacyUrl', 'https://example.com/privacy');
    render(<OrganizationCreate />);
    expect(screen.getByText('Create a New Organization')).toBeInTheDocument();

    userEvent.paste(screen.getByPlaceholderText('e.g. My Company'), 'Good Burger');
    userEvent.click(
      screen.getByRole('checkbox', {
        name: 'I agree to the Terms of Service and the Privacy Policy',
      })
    );
    userEvent.click(screen.getByText('Create Organization'));

    expect(orgCreateMock).toHaveBeenCalledWith(
      '/organizations/',
      expect.objectContaining({
        data: {agreeTerms: true, defaultTeam: true, name: 'Good Burger'},
      })
    );
    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://org-slug.sentry.io/projects/new/'
    );
  });
});
