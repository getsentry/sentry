import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DirectEnableButton} from 'sentry/views/settings/organizationIntegrations/directEnableButton';

describe('DirectEnableButton', () => {
  const organization = OrganizationFixture();

  const defaultProps = {
    providerSlug: 'github_copilot',
    userHasAccess: true,
    buttonProps: {
      size: 'sm' as const,
      priority: 'primary' as const,
    },
  };

  it('renders Enable Integration button', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/direct-enable/github_copilot/`,
      method: 'POST',
      body: {provider: {key: 'github_copilot'}},
    });

    render(<DirectEnableButton {...defaultProps} />, {organization});

    expect(screen.getByRole('button', {name: 'Enable Integration'})).toBeInTheDocument();
  });

  it('calls the direct-enable endpoint on click', async () => {
    const mockPost = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/direct-enable/github_copilot/`,
      method: 'POST',
      body: {provider: {key: 'github_copilot'}},
    });

    render(<DirectEnableButton {...defaultProps} />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Enable Integration'}));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  });

  it('keeps the button focusable with a tooltip when user does not have access', async () => {
    const mockPost = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/direct-enable/github_copilot/`,
      method: 'POST',
      body: {},
    });

    render(<DirectEnableButton {...defaultProps} userHasAccess={false} />, {
      organization,
    });

    const button = screen.getByRole('button', {name: 'Enable Integration'});
    expect(button).toHaveAttribute('aria-disabled', 'true');

    act(() => button.focus());
    expect(
      await screen.findByText('You do not have permission to enable this integration.')
    ).toBeInTheDocument();

    await userEvent.click(button);
    expect(mockPost).not.toHaveBeenCalled();
  });
});
