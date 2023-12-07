import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

    render(<Relocation {...routerProps} />, {
      context: routerContext,
      organization,
    });
  }
  describe('Get Started', function () {
    it('renders', async function () {
      renderPage('get-started');
      expect(
        await screen.findByText('Basic Information Needed to Get Started')
      ).toBeInTheDocument();
      expect(
        await screen.findByText(
          'In order to best facilitate the process some basic information will be required to ensure sucess with the relocation process of you self-hosted instance'
        )
      ).toBeInTheDocument();
      expect(await screen.findByText('Organization Slugs')).toBeInTheDocument();
      expect(await screen.findByText('Choose a Datacenter Region')).toBeInTheDocument();
    });

    it('should prevent user from going to the next step if no org slugs are entered', async function () {
      renderPage('get-started');
      expect(await screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
    });

    it('should be allowed to go to next step if org slug is entered', async function () {
      renderPage('get-started');
      const orgSlugsInput = await screen.getByLabelText('org-slugs');
      const continueButton = await screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      expect(continueButton).toBeEnabled();
    });
  });

  describe('Select Platform', function () {
    it('renders', async function () {
      renderPage('encrypt-backup');
      expect(
        await screen.findByText(
          'Create an encrypted back up of current self-hosted instance'
        )
      ).toBeInTheDocument();
      expect(
        await screen.findByText(
          'You’ll need to have the public key saved in the previous step accessible and run the command below in your terminal to ensure success'
        )
      ).toBeInTheDocument();
      expect(await screen.findByText('Understanding the command:')).toBeInTheDocument();
      expect(await screen.findByText('./sentry-admin.sh')).toBeInTheDocument();
      expect(
        await screen.findByText(
          'this is a script present in your self-hosted installation'
        )
      ).toBeInTheDocument();
      expect(await screen.findByText('/path/to/public/key/file.pub')).toBeInTheDocument();
      expect(
        await screen.findByText('path to file you created in the previous step')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('/path/to/encrypted/backup/output/file.tar')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('file that will be uploaded in the next step')
      ).toBeInTheDocument();
    });
  });
});
