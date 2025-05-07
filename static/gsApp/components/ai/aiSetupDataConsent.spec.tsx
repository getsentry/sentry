import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import AiSetupDataConsent from './AiSetupDataConsent';

describe('AiSetupDataConsent', () => {
  const organization = OrganizationFixture();

  it('renders Enable Seer button if nobody in org has acknowledged', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/autofix/setup/',
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: false,
          userHasAcknowledged: false,
        },
      }),
    });
    const promptsUpdateMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      method: 'PUT',
    });

    render(<AiSetupDataConsent groupId="1" />);

    expect(await screen.findByRole('button', {name: 'Enable Seer'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Enable Seer'}));

    await waitFor(() => {
      expect(promptsUpdateMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: {
            feature: 'seer_autofix_setup_acknowledged',
            organization_id: organization.id,
            project_id: undefined,
            status: 'dismissed',
          },
        })
      );
    });
  });

  it('renders Try Seer button if org has acknowledged but not the user', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/autofix/setup/',
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: false,
        },
      }),
    });
    const promptsUpdateMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      method: 'PUT',
    });

    render(<AiSetupDataConsent groupId="1" />);

    expect(await screen.findByRole('button', {name: 'Try Seer'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Try Seer'}));

    await waitFor(() => {
      expect(promptsUpdateMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: {
            feature: 'seer_autofix_setup_acknowledged',
            organization_id: organization.id,
            project_id: undefined,
            status: 'dismissed',
          },
        })
      );
    });
  });
});
