import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import Relocation from 'sentry/views/relocation/relocation';

describe('Relocation', function () {
  function renderPage(step) {
    const routeParams = {
      step,
    };

    const {routerProps, routerContext, organization} = initializeOrg({
      router: {
        params: routeParams,
      },
    });

    return render(<Relocation {...routerProps} />, {
      context: routerContext,
      organization,
    });
  }
  describe('Get Started', function () {
    it('renders', async function () {
      renderPage('get-started');
      expect(
        await screen.findByText('Basic information needed to get started')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('Organization slugs being relocated')
      ).toBeInTheDocument();
      expect(await screen.findByText('Choose a datacenter region')).toBeInTheDocument();
    });

    it('should prevent user from going to the next step if no org slugs or region are entered', function () {
      renderPage('get-started');
      expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
    });

    it('should be allowed to go to next step if org slug is entered and region is selected', async function () {
      renderPage('get-started');
      ConfigStore.set('regions', [{name: 'USA', url: 'https://example.com'}]);
      const orgSlugsInput = screen.getByLabelText('org-slugs');
      const continueButton = screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      await userEvent.type(screen.getByLabelText('region'), 'U');
      await userEvent.click(screen.getByRole('menuitemradio'));
      expect(continueButton).toBeEnabled();
    });
  });

  describe('Select Platform', function () {
    it('renders', async function () {
      renderPage('encrypt-backup');
      expect(
        await screen.findByText(
          'Create an encrypted backup of current self-hosted instance'
        )
      ).toBeInTheDocument();
      expect(await screen.findByText('./sentry-admin.sh')).toBeInTheDocument();
    });
  });
});
