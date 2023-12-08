import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ConfigStore from 'sentry/stores/configStore';
import Relocation from 'sentry/views/relocation/relocation';

jest.mock('sentry/actionCreators/indicator');

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

  describe('Encrypt Backup', function () {
    it('renders', async function () {
      renderPage('encrypt-backup');
      expect(
        await screen.findByText(
          'Create an encrypted backup of current self-hosted instance'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Upload Backup', function () {
    it('renders', async function () {
      renderPage('upload-backup');
      expect(
        await screen.findByText('Upload Tarball to begin the relocation process')
      ).toBeInTheDocument();
    });

    it('accepts a file upload', async function () {
      renderPage('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      expect(await screen.findByText('Start Relocation')).toBeInTheDocument();
    });

    it('accepts a file upload through drag and drop', async function () {
      renderPage('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const dropzone = screen.getByLabelText('dropzone');
      fireEvent.drop(dropzone, {dataTransfer: {files: [relocationFile]}});
      expect(await screen.findByText('Start Relocation')).toBeInTheDocument();
    });

    it('correctly removes file and prompts for file upload', async function () {
      renderPage('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      await userEvent.click(screen.getByText('Remove file'));
      expect(
        await screen.findByText('Upload Tarball to begin the relocation process')
      ).toBeInTheDocument();
    });

    it('fails to starts relocation job if some form data is missing', async function () {
      const mockapi = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
      });
      renderPage('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(mockapi).not.toHaveBeenCalled());
      expect(addErrorMessage).toHaveBeenCalledWith(
        'An error has occured while trying to start relocation job. Please contact support for further assistance.'
      );
    });

    it('starts relocation job if form data is available from previous steps', async function () {
      const mockapi = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
      });
      renderPage('get-started');
      ConfigStore.set('regions', [{name: 'USA', url: 'https://example.com'}]);
      const orgSlugsInput = screen.getByLabelText('org-slugs');
      const continueButton = screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      await userEvent.type(screen.getByLabelText('region'), 'U');
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(continueButton);
      renderPage('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(mockapi).toHaveBeenCalled());
    });
  });
});
