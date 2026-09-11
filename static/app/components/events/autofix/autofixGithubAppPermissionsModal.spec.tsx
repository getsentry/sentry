import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {
  CodingAgentHandoffPermissionsModal,
  IntegrationSettingsPermissionsModal,
  PrIterationPermissionsModal,
} from 'sentry/components/events/autofix/autofixGithubAppPermissionsModal';

const DEFAULT_INSTALLATIONS_URL = 'https://github.com/settings/installations/';

describe('GitHub App permissions modals', () => {
  describe('PrIterationPermissionsModal', () => {
    it('renders the pr-iteration copy', async () => {
      renderGlobalModal();

      act(() => {
        openModal(deps => <PrIterationPermissionsModal {...deps} />);
      });

      expect(
        await screen.findByText(
          /Seer needs additional GitHub App permissions to keep iterating on the pull requests in this run/
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Review and accept the updated permissions to let Seer continue/)
      ).toBeInTheDocument();
    });
  });

  describe('CodingAgentHandoffPermissionsModal', () => {
    it('renders the coding-agent copy and links settings', async () => {
      renderGlobalModal();

      act(() => {
        openModal(deps => <CodingAgentHandoffPermissionsModal {...deps} />);
      });

      expect(
        await screen.findByText(/does not have sufficient permissions/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', {name: 'GitHub App installation settings'})
      ).toHaveAttribute('href', DEFAULT_INSTALLATIONS_URL);
    });

    it('uses a provided installation URL for the button and link', async () => {
      const installationUrl =
        'https://github.com/organizations/example-org/settings/installations/654321/permissions/update';

      renderGlobalModal();

      act(() => {
        openModal(deps => (
          <CodingAgentHandoffPermissionsModal
            {...deps}
            installationUrl={installationUrl}
          />
        ));
      });

      const updateButton = await screen.findByRole('button', {
        name: 'Update Permissions',
      });
      expect(updateButton).toHaveAttribute('href', installationUrl);
      expect(
        screen.getByRole('link', {name: 'GitHub App installation settings'})
      ).toHaveAttribute('href', installationUrl);
    });
  });

  describe('IntegrationSettingsPermissionsModal', () => {
    it('lists the missing features', async () => {
      renderGlobalModal();

      act(() => {
        openModal(deps => (
          <IntegrationSettingsPermissionsModal
            {...deps}
            missingFeatures={[
              {
                key: 'code_review',
                name: 'Seer Code Review',
                description: 'Seer Code Review: Reviews your pull requests.',
              },
              {
                key: 'pr_iteration',
                name: 'Pull request iteration',
                description:
                  'Seer PR Iteration: Reads GitHub Actions logs and re-runs jobs.',
              },
            ]}
          />
        ));
      });

      expect(
        await screen.findByText(
          'This installation is missing permissions for the following features:'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText('Seer Code Review: Reviews your pull requests.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Seer PR Iteration: Reads GitHub Actions logs and re-runs jobs.')
      ).toBeInTheDocument();
    });
  });
});
