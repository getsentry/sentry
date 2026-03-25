import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SeerAutomation from 'getsentry/views/seerAutomation/seerAutomation';

describe('SeerAutomation', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
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

  describe('default coding agent setting', () => {
    it('sends provider name and integration id when an external agent is selected', async () => {
      // Start with no agent set so the initial value is 'none'
      const organization = OrganizationFixture({
        features: ['seat-based-seer-enabled'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {
          integrations: [{id: '123', name: 'Cursor', provider: 'cursor'}],
        },
      });

      const orgPutRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<SeerAutomation />, {organization});

      const select = await screen.findByRole('textbox', {name: /Default Coding Agent/i});
      act(() => select.focus());
      await userEvent.click(select);
      await userEvent.click(await screen.findByText('Cursor'));

      await waitFor(() => expect(orgPutRequest).toHaveBeenCalledTimes(1));
      expect(orgPutRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/`,
        expect.objectContaining({
          data: {defaultCodingAgent: 'cursor', defaultCodingAgentIntegrationId: '123'},
        })
      );
    });

    it('sends seer and clears integration id when Seer Agent is selected', async () => {
      // Start with an external integration set so the initial value is '123'
      const organization = OrganizationFixture({
        features: ['seat-based-seer-enabled'],
        defaultCodingAgentIntegrationId: 123,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {
          integrations: [{id: '123', name: 'Cursor', provider: 'cursor'}],
        },
      });

      const orgPutRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<SeerAutomation />, {organization});

      const select = await screen.findByRole('textbox', {name: /Default Coding Agent/i});
      act(() => select.focus());
      await userEvent.click(select);
      await userEvent.click(await screen.findByText('Seer Agent'));

      await waitFor(() => expect(orgPutRequest).toHaveBeenCalledTimes(1));
      expect(orgPutRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/`,
        expect.objectContaining({
          data: {defaultCodingAgent: 'seer', defaultCodingAgentIntegrationId: null},
        })
      );
    });

    it('sends none and clears integration id when No Handoff is selected', async () => {
      // Start with seer selected so the initial value is 'seer'
      const organization = OrganizationFixture({
        features: ['seat-based-seer-enabled'],
        defaultCodingAgent: 'seer',
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {integrations: []},
      });

      const orgPutRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<SeerAutomation />, {organization});

      const select = await screen.findByRole('textbox', {name: /Default Coding Agent/i});
      act(() => select.focus());
      await userEvent.click(select);
      await userEvent.click(await screen.findByText('No Handoff'));

      await waitFor(() => expect(orgPutRequest).toHaveBeenCalledTimes(1));
      expect(orgPutRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/`,
        expect.objectContaining({
          data: {defaultCodingAgent: 'none', defaultCodingAgentIntegrationId: null},
        })
      );
    });
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
      body: OrganizationFixture({autoEnableCodeReview: true}),
    });

    render(<SeerAutomation />, {organization});

    const toggle = await screen.findByRole('checkbox', {
      name: /Enable Code Review by Default/i,
    });
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    await waitFor(() => expect(orgPutRequest).toHaveBeenCalledTimes(1));
    expect(orgPutRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        data: {autoEnableCodeReview: true},
      })
    );
  });
});
