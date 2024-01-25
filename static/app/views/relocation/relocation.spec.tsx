import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import ConfigStore from 'sentry/stores/configStore';
import Relocation from 'sentry/views/relocation/relocation';

jest.mock('sentry/actionCreators/indicator');
const fakePublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw5Or1zsGE1XJTL4q+1c4
Ztu8+7SC/exrnEYlWH+LVLI8TVyuGwDTAXrgKHGwaMM5ZnjijP5i8+ph8lfLrybT
l+2D81qPIqagEtNMDaHqUDm5Tq7I2qvxkJ5YuDLawRUPccKMwWlIDR2Gvfe3efce
870EicPsExz4uPOkNXGHJZ/FwCQrLo87MXFeqrqj+0Cf+qwCQSCW9qFWe5cj+zqt
eeJa0qflcHHQzxK4/EKKpl/hkt4zi0aE/PuJgvJz2KB+X3+LzekTy90LzW3VhR4y
IAxCAaGQJVsg9dhKOORjAf4XK9aXHvy/jUSyT43opj6AgNqXlKEQjb1NBA8qbJJS
8wIDAQAB
-----END PUBLIC KEY-----`;
const fakeRegionName = 'Narnia';
const fakeRegionUrl = 'https://example.com';

describe('Relocation', function () {
  let fetchExistingRelocation: jest.Mock;
  let fetchPublicKey: jest.Mock;

  beforeEach(function () {
    MockApiClient.asyncDelay = undefined;
    MockApiClient.clearMockResponses();
    fetchExistingRelocation = MockApiClient.addMockResponse({
      url: '/relocations/',
      body: [],
    });
    fetchPublicKey = MockApiClient.addMockResponse({
      url: '/publickeys/relocations/',
      body: {
        public_key: fakePublicKey,
      },
    });

    // The tests fail because we have a "component update was not wrapped in act" error. It should
    // be safe to ignore this error, but we should remove the mock once we move to react testing
    // library.
    //
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.asyncDelay = undefined;
  });

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

  async function waitForRenderSuccess(step) {
    renderPage(step);
    await waitFor(() => expect(screen.getByTestId(step)).toBeInTheDocument());
  }

  async function waitForRenderError(step) {
    renderPage(step);
    await waitFor(() => expect(screen.getByTestId('loading-error')).toBeInTheDocument());
  }

  describe('Get Started', function () {
    it('renders', async function () {
      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(
        await screen.findByText('Basic information needed to get started')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('Organization slugs being relocated')
      ).toBeInTheDocument();
      expect(await screen.findByText('Choose a datacenter location')).toBeInTheDocument();
    });

    it('redirects to `in-progress` page if user already has active relocation', async function () {
      MockApiClient.clearMockResponses();
      fetchExistingRelocation = MockApiClient.addMockResponse({
        url: '/relocations/',
        body: [
          {
            uuid: 'ccef828a-03d8-4dd0-918a-487ffecf8717',
            status: 'IN_PROGRESS',
          },
        ],
      });
      fetchPublicKey = MockApiClient.addMockResponse({
        url: '/publickeys/relocations/',
        body: {
          public_key: fakePublicKey,
        },
      });

      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchExistingRelocation).toHaveBeenCalled());
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(browserHistory.push).toHaveBeenCalledWith('/relocation/in-progress/');
    });

    it('should prevent user from going to the next step if no org slugs or region are entered', async function () {
      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(await screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
    });

    it('should be allowed to go to next step if org slug is entered, region is selected, and promo code is entered', async function () {
      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());
      fetchPublicKey = MockApiClient.addMockResponse({
        url: '/promocodes-external/free-hugs',
        method: 'GET',
        statusCode: 200,
      });

      ConfigStore.set('regions', [{name: fakeRegionName, url: fakeRegionUrl}]);
      ConfigStore.set('relocationConfig', {selectableRegions: [fakeRegionName]});
      const orgSlugsInput = await screen.getByLabelText('org-slugs');
      const continueButton = await screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      await userEvent.type(await screen.getByLabelText('region'), 'Narnia');
      await userEvent.click(await screen.getByRole('menuitemradio'));
      expect(continueButton).toBeEnabled();
      await userEvent.click(screen.getByText('Got a promo code?', {exact: false}));
      const promoCodeInput = await screen.getByLabelText('promocode');
      await userEvent.type(promoCodeInput, 'free-hugs');
      await userEvent.click(continueButton);
      expect(addErrorMessage).not.toHaveBeenCalledWith();
      sessionStorage.clear();
    });

    it('should not be allowed to go to next step if org slug is entered, region is selected, and promo code is invalid', async function () {
      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());
      fetchPublicKey = MockApiClient.addMockResponse({
        url: '/promocodes-external/free-hugs',
        method: 'GET',
        statusCode: 403,
      });

      ConfigStore.set('regions', [{name: fakeRegionName, url: fakeRegionUrl}]);
      ConfigStore.set('relocationConfig', {selectableRegions: [fakeRegionName]});
      const orgSlugsInput = await screen.getByLabelText('org-slugs');
      const continueButton = await screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      await userEvent.type(await screen.getByLabelText('region'), 'Narnia');
      await userEvent.click(await screen.getByRole('menuitemradio'));
      expect(continueButton).toBeEnabled();
      await userEvent.click(screen.getByText('Got a promo code?', {exact: false}));
      const promoCodeInput = await screen.getByLabelText('promocode');
      await userEvent.type(promoCodeInput, 'free-hugs');
      await userEvent.click(continueButton);
      expect(addErrorMessage).toHaveBeenCalledWith(
        'That promotional code has already been claimed, does not have enough remaining uses, is no longer valid, or never existed.'
      );
    });

    it('should show loading indicator and error message if existing relocation retrieval failed', async function () {
      MockApiClient.clearMockResponses();
      fetchExistingRelocation = MockApiClient.addMockResponse({
        url: '/relocations/',
        statusCode: 400,
      });
      fetchPublicKey = MockApiClient.addMockResponse({
        url: '/publickeys/relocations/',
        body: {
          public_key: fakePublicKey,
        },
      });

      await waitForRenderError('get-started');
      await waitFor(() => expect(fetchExistingRelocation).toHaveBeenCalled());

      expect(fetchPublicKey).toHaveBeenCalledTimes(1);
      expect(
        await screen.queryByRole('button', {name: 'Continue'})
      ).not.toBeInTheDocument();
      expect(await screen.queryByLabelText('org-slugs')).not.toBeInTheDocument();
      expect(await screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();

      MockApiClient.addMockResponse({
        url: '/relocations/',
        body: [],
      });

      await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId('get-started')).toBeInTheDocument());

      expect(fetchExistingRelocation).toHaveBeenCalledTimes(1);
      expect(await screen.queryByLabelText('org-slugs')).toBeInTheDocument();
      expect(await screen.queryByRole('button', {name: 'Continue'})).toBeInTheDocument();
    });
  });

  describe('Public Key', function () {
    it('should show instructions if key retrieval was successful', async function () {
      await waitForRenderSuccess('public-key');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(
        await screen.findByText("Save Sentry's public key to your machine")
      ).toBeInTheDocument();
      expect(await screen.getByText('key.pub')).toBeInTheDocument();
      expect(await screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
    });

    it('should show loading indicator if key retrieval still in progress', function () {
      MockApiClient.asyncDelay = 1;

      renderPage('public-key');

      expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
      expect(screen.queryByText('key.pub')).not.toBeInTheDocument();
    });

    it('should show loading indicator and error message if key retrieval failed', async function () {
      MockApiClient.clearMockResponses();
      fetchExistingRelocation = MockApiClient.addMockResponse({
        url: '/relocations/',
        body: [],
      });
      fetchPublicKey = MockApiClient.addMockResponse({
        url: '/publickeys/relocations/',
        statusCode: 400,
      });

      await waitForRenderError('public-key');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(fetchExistingRelocation).toHaveBeenCalledTimes(1);
      expect(
        await screen.queryByRole('button', {name: 'Continue'})
      ).not.toBeInTheDocument();
      expect(await screen.queryByText('key.pub')).not.toBeInTheDocument();
      expect(await screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();

      MockApiClient.addMockResponse({
        url: '/publickeys/relocations/',
        body: {
          public_key: fakePublicKey,
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId('public-key')).toBeInTheDocument());

      expect(fetchExistingRelocation).toHaveBeenCalledTimes(1);
      expect(await screen.queryByText('key.pub')).toBeInTheDocument();
      expect(await screen.queryByRole('button', {name: 'Continue'})).toBeInTheDocument();
    });
  });

  describe('Encrypt Backup', function () {
    it('renders', async function () {
      await waitForRenderSuccess('encrypt-backup');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(
        await screen.findByText(
          'Create an encrypted backup of your current self-hosted instance'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Upload Backup', function () {
    it('renders', async function () {
      await waitForRenderSuccess('upload-backup');
      expect(
        await screen.findByText('Upload Tarball to begin the relocation process')
      ).toBeInTheDocument();
    });

    it('accepts a file upload', async function () {
      await waitForRenderSuccess('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      expect(await screen.findByText('hello.tar')).toBeInTheDocument();
      expect(await screen.findByText('Start Relocation')).toBeInTheDocument();
    });

    it('accepts a file upload through drag and drop', async function () {
      await waitForRenderSuccess('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const dropzone = screen.getByLabelText('dropzone');
      fireEvent.drop(dropzone, {dataTransfer: {files: [relocationFile]}});
      expect(await screen.findByText('hello.tar')).toBeInTheDocument();
      expect(await screen.findByText('Start Relocation')).toBeInTheDocument();
    });

    it('correctly removes file and prompts for file upload', async function () {
      await waitForRenderSuccess('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      await userEvent.click(screen.getByText('Remove file'));
      expect(screen.queryByText('hello.tar')).not.toBeInTheDocument();
      expect(
        await screen.findByText('Upload Tarball to begin the relocation process')
      ).toBeInTheDocument();
    });

    it('fails to starts relocation job if some form data is missing', async function () {
      const mockapi = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
      });
      await waitForRenderSuccess('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(mockapi).not.toHaveBeenCalled());
      expect(addErrorMessage).toHaveBeenCalledWith(
        'An error has occurred while trying to start relocation job. Please contact support for further assistance.'
      );
    });

    it('starts relocation job if form data is available from previous steps', async function () {
      const mockapi = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
        responseJSON: [
          {
            uuid: 'ccef828a-03d8-4dd0-918a-487ffecf8717',
            status: 'IN_PROGRESS',
          },
        ],
      });

      await waitForRenderSuccess('get-started');
      ConfigStore.set('regions', [{name: fakeRegionName, url: fakeRegionUrl}]);
      ConfigStore.set('relocationConfig', {selectableRegions: [fakeRegionName]});
      const orgSlugsInput = await screen.getByLabelText('org-slugs');
      const continueButton = await screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      await userEvent.type(screen.getByLabelText('region'), 'Narnia');
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(continueButton);

      await waitForRenderSuccess('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() =>
        expect(mockapi).toHaveBeenCalledWith(
          '/relocations/',
          expect.objectContaining({host: fakeRegionUrl, method: 'POST'})
        )
      );
      expect(addSuccessMessage).toHaveBeenCalledWith(
        "Your relocation has started - we'll email you with updates as soon as we have 'em!"
      );

      await waitForRenderSuccess('in-progress');
    });

    it('throws error if user already has an in-progress relocation job', async function () {
      const mockapi = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
        statusCode: 409,
      });

      await waitForRenderSuccess('get-started');
      ConfigStore.set('regions', [{name: fakeRegionName, url: fakeRegionUrl}]);
      ConfigStore.set('relocationConfig', {selectableRegions: [fakeRegionName]});
      const orgSlugsInput = screen.getByLabelText('org-slugs');
      const continueButton = screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      await userEvent.type(screen.getByLabelText('region'), 'Narnia');
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(continueButton);

      await waitForRenderSuccess('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(mockapi).toHaveBeenCalled());
      expect(addErrorMessage).toHaveBeenCalledWith(
        'You already have an in-progress relocation job.'
      );
    });

    it('throws error if daily limit of relocations has been reached', async function () {
      const mockapi = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
        statusCode: 429,
      });

      await waitForRenderSuccess('get-started');
      ConfigStore.set('regions', [{name: fakeRegionName, url: fakeRegionUrl}]);
      ConfigStore.set('relocationConfig', {selectableRegions: [fakeRegionName]});
      const orgSlugsInput = screen.getByLabelText('org-slugs');
      const continueButton = screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      await userEvent.type(screen.getByLabelText('region'), 'Narnia');
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(continueButton);
      await waitForRenderSuccess('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(mockapi).toHaveBeenCalled());
      expect(addErrorMessage).toHaveBeenCalledWith(
        'We have reached the daily limit of relocations - please try again tomorrow, or contact support.'
      );
    });

    it('throws error if user session has expired', async function () {
      const mockapi = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
        statusCode: 401,
      });
      ConfigStore.set('regions', [{name: fakeRegionName, url: fakeRegionUrl}]);
      ConfigStore.set('relocationConfig', {selectableRegions: [fakeRegionName]});

      await waitForRenderSuccess('get-started');
      const orgSlugsInput = screen.getByLabelText('org-slugs');
      const continueButton = screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      await userEvent.type(screen.getByLabelText('region'), 'Narnia');
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(continueButton);

      await waitForRenderSuccess('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(mockapi).toHaveBeenCalled());
      expect(addErrorMessage).toHaveBeenCalledWith('Your session has expired.');
    });

    it('throws error for 500 error', async function () {
      const mockapi = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
        statusCode: 500,
      });
      ConfigStore.set('regions', [{name: fakeRegionName, url: fakeRegionUrl}]);
      ConfigStore.set('relocationConfig', {selectableRegions: [fakeRegionName]});

      await waitForRenderSuccess('get-started');
      const orgSlugsInput = screen.getByLabelText('org-slugs');
      const continueButton = screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      await userEvent.type(screen.getByLabelText('region'), 'Narnia');
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(continueButton);

      await waitForRenderSuccess('upload-backup');
      const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
      const input = screen.getByLabelText('file-upload');
      await userEvent.upload(input, relocationFile);
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(mockapi).toHaveBeenCalled());
      expect(addErrorMessage).toHaveBeenCalledWith(
        'An error has occurred while trying to start relocation job. Please contact support for further assistance.'
      );
    });
  });

  describe('In Progress', function () {
    it('renders', async function () {
      MockApiClient.clearMockResponses();
      fetchExistingRelocation = MockApiClient.addMockResponse({
        url: '/relocations/',
        body: [
          {
            uuid: 'ccef828a-03d8-4dd0-918a-487ffecf8717',
            status: 'IN_PROGRESS',
          },
        ],
      });
      fetchPublicKey = MockApiClient.addMockResponse({
        url: '/publickeys/relocations/',
        body: {
          public_key: fakePublicKey,
        },
      });

      await waitForRenderSuccess('in-progress');
      expect(
        await screen.findByText('Your relocation is under way!')
      ).toBeInTheDocument();
    });

    it('redirects to `get-started` page if there is no existing relocation', async function () {
      await waitForRenderSuccess('in-progress');
      await waitFor(() => expect(fetchExistingRelocation).toHaveBeenCalled());
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(browserHistory.push).toHaveBeenCalledWith('/relocation/get-started/');
    });

    it('redirects to `get-started` page if there is no active relocation', async function () {
      MockApiClient.clearMockResponses();
      fetchExistingRelocation = MockApiClient.addMockResponse({
        url: '/relocations/',
        body: [
          {
            uuid: 'ccef828a-03d8-4dd0-918a-487ffecf8717',
            status: 'SUCCESS',
          },
        ],
      });
      fetchPublicKey = MockApiClient.addMockResponse({
        url: '/publickeys/relocations/',
        body: {
          public_key: fakePublicKey,
        },
      });

      await waitForRenderSuccess('in-progress');
      await waitFor(() => expect(fetchExistingRelocation).toHaveBeenCalled());
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(browserHistory.push).toHaveBeenCalledWith('/relocation/get-started/');
    });
  });
});
