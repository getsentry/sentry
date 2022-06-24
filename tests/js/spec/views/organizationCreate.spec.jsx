import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationCreate from 'sentry/views/organizationCreate';

describe('OrganizationCreate', function () {
  beforeEach(() => {
    ConfigStore.get('termsUrl', null);
    ConfigStore.get('privacyUrl', null);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
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
  });
});
