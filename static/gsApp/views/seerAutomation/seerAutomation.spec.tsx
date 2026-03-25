import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';

import SeerAutomation from 'getsentry/views/seerAutomation/seerAutomation';

describe('SeerAutomation', () => {
  beforeEach(() => {
    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      method: 'GET',
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isCodeReviewEnabled: true,
        isSeerConfigured: true,
      },
    });
  });

  it('shows no-active-subscription banner inline for legacy Seer cohorts', () => {
    const organization = OrganizationFixture({
      features: ['code-review-beta'],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      method: 'GET',
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isCodeReviewEnabled: true,
        isSeerConfigured: true,
      },
    });

    render(<SeerAutomation />, {organization});

    expect(
      screen.getByText('You are using an older Seer experience.')
    ).toBeInTheDocument();
  });

  it('does not show legacy banner for orgs without legacy or beta Seer features', () => {
    const organization = OrganizationFixture({
      features: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      method: 'GET',
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: false,
        isCodeReviewEnabled: false,
        isSeerConfigured: false,
      },
    });

    render(<SeerAutomation />, {organization});

    expect(
      screen.queryByText('You are using an older Seer experience.')
    ).not.toBeInTheDocument();
  });

  it('can update the default coding agent setting', async () => {
    const organization = OrganizationFixture({
      features: ['seat-based-seer-enabled'],
    });

    const mockCodingAgentIntegration: CodingAgentIntegration = {
      id: '123',
      name: 'Cursor',
      provider: 'cursor',
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {
        integrations: [mockCodingAgentIntegration],
      },
    });

    const orgPutRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: OrganizationFixture({
        defaultCodingAgent: 'cursor_background_agent',
        defaultCodingAgentIntegrationId: 123,
      }),
    });

    render(<SeerAutomation />, {organization});

    const select = await screen.findByRole('textbox', {
      name: /Default Coding Agent/i,
    });

    act(() => {
      select.focus();
    });

    await userEvent.click(select);
    const cursorOption = await screen.findByText('Cursor');
    await userEvent.click(cursorOption);

    await waitFor(() => {
      expect(orgPutRequest).toHaveBeenCalledTimes(1);
    });
    expect(orgPutRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        data: {defaultCodingAgent: '123', defaultCodingAgentIntegrationId: 123},
      })
    );
  });

  it('can update default code review setting', async () => {
    const organization = OrganizationFixture({
      features: ['seat-based-seer-enabled'],
      autoEnableCodeReview: false,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {integrations: []},
    });

    const orgPutRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: OrganizationFixture({
        autoEnableCodeReview: true,
      }),
    });

    render(<SeerAutomation />, {organization});

    const toggle = await screen.findByRole('checkbox', {
      name: /Enable Code Review by Default/i,
    });
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    await waitFor(() => {
      expect(orgPutRequest).toHaveBeenCalledTimes(1);
    });
    expect(orgPutRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        data: {autoEnableCodeReview: true},
      })
    );
  });
});
