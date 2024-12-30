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
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import Relocation from 'sentry/views/relocation/relocation';

jest.mock('sentry/actionCreators/indicator');

const fakeOrgSlug = 'test-org';
const fakePromoCode = 'free-hugs';
const fakePublicKey = `FAKE-PK-ANY`;

type FakeRegion = {
  name: string;
  publicKey: string;
  url: string;
};

const fakeRegions: {[key: string]: FakeRegion} = {
  Earth: {
    name: 'earth',
    url: 'https://earth.example.com',
    publicKey: 'FAKE-PK-EARTH',
  },
  Moon: {
    name: 'moon',
    url: 'https://moon.example.com',
    publicKey: 'FAKE-PK-MOON',
  },
};

describe('Relocation', function () {
  let router: InjectedRouter;
  let fetchExistingRelocations: jest.Mock;
  let fetchPublicKeys: jest.Mock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.asyncDelay = undefined;
    sessionStorage.clear();

    ConfigStore.set('regions', [
      {name: fakeRegions.Earth.name, url: fakeRegions.Earth.url},
      {name: fakeRegions.Moon.name, url: fakeRegions.Moon.url},
    ]);
    ConfigStore.set('relocationConfig', {
      selectableRegions: [fakeRegions.Earth.name, fakeRegions.Moon.name],
    });

    // For tests that don't care about the difference between our "earth" and "moon" regions, we can
    // re-use the same mock responses, with the same generic public key for both.
    fetchExistingRelocations = MockApiClient.addMockResponse({
      url: '/relocations/',
      body: [],
    });
    fetchPublicKeys = MockApiClient.addMockResponse({
      url: '/publickeys/relocations/',
      body: {
        public_key: fakePublicKey,
      },
    });

    // The tests fail because we have a "component update was not wrapped in act" error. It should
    // be safe to ignore this error, but we should remove the mock once we move to react testing
    // library.
    //

    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.asyncDelay = undefined;
    sessionStorage.clear();
  });

  function renderPage(step: string) {
    const routeParams = {
      step,
    };

    const {routerProps, organization, ...rest} = initializeOrg({
      router: {
        params: routeParams,
      },
    });
    router = rest.router;

    return render(<Relocation {...routerProps} />, {
      router,
      organization,
    });
  }

  async function waitForRenderSuccess(step: string) {
    renderPage(step);
    await waitFor(() => expect(screen.getByTestId(step)).toBeInTheDocument());
  }

  async function waitForRenderError(step: string) {
    renderPage(step);
    await waitFor(() => expect(screen.getByTestId('loading-error')).toBeInTheDocument());
  }

  describe('Get Started', function () {
    it('renders', async function () {
      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

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
      fetchExistingRelocations = MockApiClient.addMockResponse({
        url: '/relocations/',
        body: [
          {
            uuid: 'ccef828a-03d8-4dd0-918a-487ffecf8717',
            status: 'IN_PROGRESS',
          },
        ],
      });
      fetchPublicKeys = MockApiClient.addMockResponse({
        url: '/publickeys/relocations/',
        body: {
          public_key: fakePublicKey,
        },
      });

      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchExistingRelocations).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

      expect(router.push).toHaveBeenCalledWith('/relocation/in-progress/');
    });

    it('should prevent user from going to the next step if no org slugs or region are entered', async function () {
      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

      expect(screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
    });

    it('should be allowed to go to next step if org slug is entered, region is selected, and promo code is entered', async function () {
      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));
      const fetchPromoCode = MockApiClient.addMockResponse({
        url: `/promocodes-external/${fakePromoCode}`,
        method: 'GET',
        statusCode: 200,
      });

      await userEvent.type(screen.getByLabelText('org-slugs'), fakeOrgSlug);
      await userEvent.type(screen.getByLabelText('region'), fakeRegions.Earth.name);
      await userEvent.click(screen.getByRole('menuitemradio'));
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();

      await userEvent.click(screen.getByText('Got a promo code?', {exact: false}));
      await userEvent.type(screen.getByLabelText('promocode'), fakePromoCode);
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
      await waitFor(() => expect(fetchPromoCode).toHaveBeenCalledTimes(1));
      expect(addErrorMessage).not.toHaveBeenCalled();
    });

    it('should persist form data across reloads', async function () {
      sessionStorage.setItem(
        'relocationOnboarding',
        JSON.stringify({
          orgSlugs: fakeOrgSlug,
          promoCode: fakePromoCode,
          regionUrl: fakeRegions.Earth.url,
        })
      );

      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

      expect(screen.getByLabelText('org-slugs')).toHaveValue(fakeOrgSlug);
      expect(screen.getByLabelText('promocode')).toHaveValue(fakePromoCode);
    });

    it('should not be allowed to go to next step if org slug is entered, region is selected, and promo code is invalid', async function () {
      await waitForRenderSuccess('get-started');
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));
      const fetchPromoCode = MockApiClient.addMockResponse({
        url: `/promocodes-external/${fakePromoCode}`,
        method: 'GET',
        statusCode: 403,
      });

      await userEvent.type(screen.getByLabelText('org-slugs'), fakeOrgSlug);
      await userEvent.type(screen.getByLabelText('region'), fakeRegions.Earth.name);
      await userEvent.click(screen.getByRole('menuitemradio'));
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();

      await userEvent.click(screen.getByText('Got a promo code?', {exact: false}));
      await userEvent.type(screen.getByLabelText('promocode'), fakePromoCode);
      expect(screen.getByRole('button', {name: 'Continue'})).toBeEnabled();

      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
      await waitFor(() => expect(fetchPromoCode).toHaveBeenCalledTimes(1));
      expect(addErrorMessage).toHaveBeenCalledWith(
        'That promotional code has already been claimed, does not have enough remaining uses, is no longer valid, or never existed.'
      );
    });

    it('should show loading indicator and error message if existing relocation retrieval failed', async function () {
      MockApiClient.clearMockResponses();

      // Note: only one fails, but that is enough.
      const failingFetchExistingEarthRelocation = MockApiClient.addMockResponse({
        host: fakeRegions.Earth.url,
        url: `/relocations/`,
        statusCode: 400,
      });
      const successfulFetchExistingMoonRelocation = MockApiClient.addMockResponse({
        host: fakeRegions.Moon.url,
        url: '/relocations/',
        body: [],
      });
      fetchPublicKeys = MockApiClient.addMockResponse({
        url: '/publickeys/relocations/',
        body: {
          public_key: fakePublicKey,
        },
      });

      await waitForRenderError('get-started');
      await waitFor(() =>
        expect(failingFetchExistingEarthRelocation).toHaveBeenCalledTimes(1)
      );
      await waitFor(() =>
        expect(successfulFetchExistingMoonRelocation).toHaveBeenCalledTimes(1)
      );

      expect(fetchPublicKeys).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
      expect(screen.queryByLabelText('org-slugs')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();

      const successfulFetchExistingEarthRelocation = MockApiClient.addMockResponse({
        host: fakeRegions.Earth.url,
        url: '/relocations/',
        body: [],
      });

      await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByTestId('get-started')).toBeInTheDocument());

      await waitFor(() =>
        expect(successfulFetchExistingEarthRelocation).toHaveBeenCalledTimes(1)
      );
      await waitFor(() =>
        expect(successfulFetchExistingMoonRelocation).toHaveBeenCalledTimes(2)
      );
      expect(screen.queryByLabelText('org-slugs')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Continue'})).toBeInTheDocument();
    });
  });

  describe('Public Key', function () {
    beforeEach(function () {
      sessionStorage.setItem(
        'relocationOnboarding',
        JSON.stringify({
          orgSlugs: fakeOrgSlug,
          promoCode: fakePromoCode,
          regionUrl: fakeRegions.Earth.url,
        })
      );
    });

    it('should show instructions if key retrieval was successful', async function () {
      await waitForRenderSuccess('public-key');
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

      expect(
        await screen.findByText("Save Sentry's public key to your machine")
      ).toBeInTheDocument();
      expect(screen.getByText('key.pub')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
    });

    it('should show loading indicator if key retrieval still in progress', function () {
      MockApiClient.asyncDelay = 1;

      renderPage('public-key');

      expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
      expect(screen.queryByText('key.pub')).not.toBeInTheDocument();
    });

    it('should show loading indicator and error message if key retrieval failed', async function () {
      MockApiClient.clearMockResponses();
      fetchExistingRelocations = MockApiClient.addMockResponse({
        url: '/relocations/',
        body: [],
      });

      // Note: only one fails, but that is enough.
      const failingFetchEarthPublicKey = MockApiClient.addMockResponse({
        host: fakeRegions.Earth.url,
        url: `/publickeys/relocations/`,
        statusCode: 400,
      });
      const successfulFetchMoonPublicKey = MockApiClient.addMockResponse({
        host: fakeRegions.Moon.url,
        url: '/publickeys/relocations/',
        body: {
          public_key: fakeRegions.Moon.publicKey,
        },
      });

      await waitForRenderError('public-key');
      await waitFor(() => expect(failingFetchEarthPublicKey).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(successfulFetchMoonPublicKey).toHaveBeenCalledTimes(1));

      expect(fetchExistingRelocations).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('button', {name: 'Continue'})).not.toBeInTheDocument();
      expect(screen.queryByText('key.pub')).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();

      const successfulFetchEarthPublicKey = MockApiClient.addMockResponse({
        host: fakeRegions.Earth.url,
        url: '/publickeys/relocations/',
        body: {
          public_key: fakeRegions.Earth.publicKey,
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
      await waitFor(() => expect(successfulFetchEarthPublicKey).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(successfulFetchMoonPublicKey).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByTestId('public-key')).toBeInTheDocument());

      expect(fetchExistingRelocations).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('key.pub')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Continue'})).toBeInTheDocument();
    });

    it('redirects to `get-started` page if expected local storage data is missing', async function () {
      sessionStorage.setItem(
        'relocationOnboarding',
        JSON.stringify({
          orgSlugs: fakeOrgSlug,
          // regionUrl missing
        })
      );

      await waitForRenderSuccess('public-key');
      await waitFor(() => expect(fetchExistingRelocations).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

      expect(router.push).toHaveBeenCalledWith('/relocation/get-started/');
    });
  });

  describe('Encrypt Backup', function () {
    it('renders', async function () {
      await waitForRenderSuccess('encrypt-backup');
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

      expect(
        await screen.findByText(
          'Create an encrypted backup of your current self-hosted instance'
        )
      ).toBeInTheDocument();
    });

    it('redirects to `get-started` page if expected local storage data is missing', async function () {
      sessionStorage.setItem(
        'relocationOnboarding',
        JSON.stringify({
          // orgSlugs missing
          regionUrl: fakeRegions.Earth.url,
        })
      );

      await waitForRenderSuccess('encrypt-backup');
      await waitFor(() => expect(fetchExistingRelocations).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

      expect(router.push).toHaveBeenCalledWith('/relocation/get-started/');
    });
  });

  describe('Upload Backup', function () {
    beforeEach(function () {
      sessionStorage.setItem(
        'relocationOnboarding',
        JSON.stringify({
          orgSlugs: fakeOrgSlug,
          promoCode: fakePromoCode,
          regionUrl: fakeRegions.Earth.url,
        })
      );
    });

    it('renders', async function () {
      await waitForRenderSuccess('upload-backup');
      expect(
        await screen.findByText('Upload Tarball to begin the relocation process')
      ).toBeInTheDocument();
    });

    it('accepts a file upload', async function () {
      await waitForRenderSuccess('upload-backup');
      await userEvent.upload(
        screen.getByLabelText('file-upload'),
        new File(['hello'], 'hello.tar', {type: 'file'})
      );
      expect(await screen.findByText('hello.tar')).toBeInTheDocument();
      expect(await screen.findByText('Start Relocation')).toBeInTheDocument();
    });

    it('accepts a file upload through drag and drop', async function () {
      await waitForRenderSuccess('upload-backup');
      fireEvent.drop(screen.getByLabelText('dropzone'), {
        dataTransfer: {files: [new File(['hello'], 'hello.tar', {type: 'file'})]},
      });
      expect(await screen.findByText('hello.tar')).toBeInTheDocument();
      expect(await screen.findByText('Start Relocation')).toBeInTheDocument();
    });

    it('correctly removes file and prompts for file upload', async function () {
      await waitForRenderSuccess('upload-backup');
      await userEvent.upload(
        screen.getByLabelText('file-upload'),
        new File(['hello'], 'hello.tar', {type: 'file'})
      );
      await userEvent.click(screen.getByText('Remove file'));
      expect(screen.queryByText('hello.tar')).not.toBeInTheDocument();
      expect(
        await screen.findByText('Upload Tarball to begin the relocation process')
      ).toBeInTheDocument();
    });

    it('starts relocation job if form data is available from previous steps', async function () {
      const postRelocation = MockApiClient.addMockResponse({
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
      await userEvent.type(screen.getByLabelText('org-slugs'), fakeOrgSlug);
      await userEvent.type(screen.getByLabelText('region'), fakeRegions.Earth.name);
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitForRenderSuccess('upload-backup');
      await userEvent.upload(
        screen.getByLabelText('file-upload'),
        new File(['hello'], 'hello.tar', {type: 'file'})
      );
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() =>
        expect(postRelocation).toHaveBeenCalledWith(
          '/relocations/',
          expect.objectContaining({host: fakeRegions.Earth.url, method: 'POST'})
        )
      );
      expect(addSuccessMessage).toHaveBeenCalledWith(
        "Your relocation has started - we'll email you with updates as soon as we have 'em!"
      );

      await waitForRenderSuccess('in-progress');
    });

    it('throws error if user already has an in-progress relocation job', async function () {
      const postRelocation = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
        statusCode: 409,
      });

      await waitForRenderSuccess('get-started');
      await userEvent.type(screen.getByLabelText('org-slugs'), fakeOrgSlug);
      await userEvent.type(screen.getByLabelText('region'), fakeRegions.Earth.name);
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitForRenderSuccess('upload-backup');
      await userEvent.upload(
        screen.getByLabelText('file-upload'),
        new File(['hello'], 'hello.tar', {type: 'file'})
      );
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(postRelocation).toHaveBeenCalledTimes(1));
      expect(addErrorMessage).toHaveBeenCalledWith(
        'You already have an in-progress relocation job.'
      );
    });

    it('throws error if daily limit of relocations has been reached', async function () {
      const postRelocation = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
        statusCode: 429,
      });

      await waitForRenderSuccess('get-started');
      await userEvent.type(screen.getByLabelText('org-slugs'), fakeOrgSlug);
      await userEvent.type(screen.getByLabelText('region'), fakeRegions.Earth.name);
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitForRenderSuccess('upload-backup');
      await userEvent.upload(
        screen.getByLabelText('file-upload'),
        new File(['hello'], 'hello.tar', {type: 'file'})
      );
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(postRelocation).toHaveBeenCalledTimes(1));
      expect(addErrorMessage).toHaveBeenCalledWith(
        'We have reached the daily limit of relocations - please try again tomorrow, or contact support.'
      );
    });

    it('throws error if user session has expired', async function () {
      const postRelocation = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
        statusCode: 401,
      });

      await waitForRenderSuccess('get-started');
      await userEvent.type(screen.getByLabelText('org-slugs'), fakeOrgSlug);
      await userEvent.type(screen.getByLabelText('region'), fakeRegions.Earth.name);
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitForRenderSuccess('upload-backup');
      await userEvent.upload(
        screen.getByLabelText('file-upload'),
        new File(['hello'], 'hello.tar', {type: 'file'})
      );
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(postRelocation).toHaveBeenCalledTimes(1));
      expect(addErrorMessage).toHaveBeenCalledWith('Your session has expired.');
    });

    it('throws error for 500 error', async function () {
      const postRelocation = MockApiClient.addMockResponse({
        url: `/relocations/`,
        method: 'POST',
        statusCode: 500,
      });

      await waitForRenderSuccess('get-started');
      await userEvent.type(screen.getByLabelText('org-slugs'), fakeOrgSlug);
      await userEvent.type(screen.getByLabelText('region'), fakeRegions.Earth.name);
      await userEvent.click(screen.getByRole('menuitemradio'));
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitForRenderSuccess('upload-backup');
      await userEvent.upload(
        screen.getByLabelText('file-upload'),
        new File(['hello'], 'hello.tar', {type: 'file'})
      );
      await userEvent.click(await screen.findByText('Start Relocation'));
      await waitFor(() => expect(postRelocation).toHaveBeenCalledTimes(1));
      expect(addErrorMessage).toHaveBeenCalledWith(
        'An error has occurred while trying to start relocation job. Please contact support for further assistance.'
      );
    });

    it('redirects to `get-started` page if expected local storage data is missing', async function () {
      sessionStorage.setItem('relocationOnboarding', JSON.stringify({}));

      await waitForRenderSuccess('upload-backup');
      await waitFor(() => expect(fetchExistingRelocations).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

      expect(router.push).toHaveBeenCalledWith('/relocation/get-started/');
    });
  });

  describe('In Progress', function () {
    it('renders', async function () {
      MockApiClient.clearMockResponses();
      fetchExistingRelocations = MockApiClient.addMockResponse({
        url: '/relocations/',
        body: [
          {
            uuid: 'ccef828a-03d8-4dd0-918a-487ffecf8717',
            status: 'IN_PROGRESS',
          },
        ],
      });
      fetchPublicKeys = MockApiClient.addMockResponse({
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
      await waitFor(() => expect(fetchExistingRelocations).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

      expect(router.push).toHaveBeenCalledWith('/relocation/get-started/');
    });

    it('redirects to `get-started` page if there is no active relocation', async function () {
      MockApiClient.clearMockResponses();
      fetchExistingRelocations = MockApiClient.addMockResponse({
        url: '/relocations/',
        body: [
          {
            uuid: 'ccef828a-03d8-4dd0-918a-487ffecf8717',
            status: 'SUCCESS',
          },
        ],
      });
      fetchPublicKeys = MockApiClient.addMockResponse({
        url: '/publickeys/relocations/',
        body: {
          public_key: fakePublicKey,
        },
      });

      await waitForRenderSuccess('in-progress');
      await waitFor(() => expect(fetchExistingRelocations).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(fetchPublicKeys).toHaveBeenCalledTimes(2));

      expect(router.push).toHaveBeenCalledWith('/relocation/get-started/');
    });
  });
});
