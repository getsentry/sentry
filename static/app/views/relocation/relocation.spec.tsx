import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import Relocation from 'sentry/views/relocation/relocation';

const fakePublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw5Or1zsGE1XJTL4q+1c4
Ztu8+7SC/exrnEYlWH+LVLI8TVyuGwDTAXrgKHGwaMM5ZnjijP5i8+ph8lfLrybT
l+2D81qPIqagEtNMDaHqUDm5Tq7I2qvxkJ5YuDLawRUPccKMwWlIDR2Gvfe3efce
870EicPsExz4uPOkNXGHJZ/FwCQrLo87MXFeqrqj+0Cf+qwCQSCW9qFWe5cj+zqt
eeJa0qflcHHQzxK4/EKKpl/hkt4zi0aE/PuJgvJz2KB+X3+LzekTy90LzW3VhR4y
IAxCAaGQJVsg9dhKOORjAf4XK9aXHvy/jUSyT43opj6AgNqXlKEQjb1NBA8qbJJS
8wIDAQAB
-----END PUBLIC KEY-----`;

describe('Relocation', function () {
  let fetchPublicKey: jest.Mock;

  beforeEach(function () {
    MockApiClient.asyncDelay = undefined;
    MockApiClient.clearMockResponses();
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
    // console.error = consoleError;
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

  describe('Get Started', function () {
    it('renders', async function () {
      renderPage('get-started');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(
        await screen.findByText('Basic information needed to get started')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('Organization slugs being relocated')
      ).toBeInTheDocument();
      expect(await screen.findByText('Choose a datacenter region')).toBeInTheDocument();
    });

    it('should prevent user from going to the next step if no org slugs or region are entered', async function () {
      renderPage('get-started');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(await screen.getByRole('button', {name: 'Continue'})).toBeDisabled();
    });

    it('should be allowed to go to next step if org slug is entered and region is selected', async function () {
      renderPage('get-started');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      ConfigStore.set('regions', [{name: 'USA', url: 'https://example.com'}]);
      const orgSlugsInput = await screen.getByLabelText('org-slugs');
      const continueButton = await screen.getByRole('button', {name: 'Continue'});
      await userEvent.type(orgSlugsInput, 'test-org');
      await userEvent.type(await screen.getByLabelText('region'), 'U');
      await userEvent.click(await screen.getByRole('menuitemradio'));
      expect(continueButton).toBeEnabled();
    });
  });

  describe('Public Key', function () {
    it('should show instructions if key retrieval was successful', async function () {
      renderPage('public-key');
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
      fetchPublicKey = MockApiClient.addMockResponse({
        url: '/publickeys/relocations/',
        statusCode: 400,
      });

      renderPage('public-key');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

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

      expect(await screen.queryByText('key.pub')).toBeInTheDocument();
      expect(await screen.queryByRole('button', {name: 'Continue'})).toBeInTheDocument();
    });
  });

  describe('Select Platform', function () {
    it('renders', async function () {
      renderPage('encrypt-backup');
      await waitFor(() => expect(fetchPublicKey).toHaveBeenCalled());

      expect(
        await screen.findByText(
          'Create an encrypted backup of current self-hosted instance'
        )
      ).toBeInTheDocument();
      expect(await screen.findByText('./sentry-admin.sh')).toBeInTheDocument();
    });
  });
});
