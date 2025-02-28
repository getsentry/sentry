import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {SentryAppTokenFixture} from 'sentry-fixture/sentryAppToken';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import SentryApplicationDetails from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails';

describe('Sentry Application Details', function () {
  let sentryApp: ReturnType<typeof SentryAppFixture>;
  let token: ReturnType<typeof SentryAppTokenFixture>;
  let createAppRequest: jest.Mock;
  let editAppRequest: jest.Mock;

  const maskedValue = '************oken';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('Creating a new public Sentry App', () => {
    function renderComponent() {
      const publicRouter = RouterFixture({
        location: LocationFixture({
          pathname: `/settings/developer-settings/new-public/`,
        }),
      });
      return render(<SentryApplicationDetails />, {router: publicRouter});
    }

    beforeEach(() => {
      createAppRequest = MockApiClient.addMockResponse({
        url: '/sentry-apps/',
        method: 'POST',
        body: [],
      });
    });

    it('has inputs for redirectUrl and verifyInstall', () => {
      renderComponent();

      expect(
        screen.getByRole('checkbox', {name: 'Verify Installation'})
      ).toBeInTheDocument();

      expect(screen.getByRole('textbox', {name: 'Redirect URL'})).toBeInTheDocument();
    });

    it('shows empty scopes and no credentials', function () {
      renderComponent();

      expect(screen.getByText('Permissions')).toBeInTheDocument();

      // new app starts off with no scopes selected
      expect(screen.getByRole('checkbox', {name: 'issue'})).not.toBeChecked();
      expect(screen.getByRole('checkbox', {name: 'error'})).not.toBeChecked();
      expect(screen.getByRole('checkbox', {name: 'comment'})).not.toBeChecked();
    });

    it('does not show logo upload fields', function () {
      renderComponent();

      expect(screen.queryByText('Logo')).not.toBeInTheDocument();
      expect(screen.queryByText('Small Icon')).not.toBeInTheDocument();
    });

    it('saves', async function () {
      renderComponent();

      await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'Test App');
      await userEvent.type(screen.getByRole('textbox', {name: 'Author'}), 'Sentry');

      await userEvent.type(
        screen.getByRole('textbox', {name: 'Webhook URL'}),
        'https://webhook.com'
      );

      await userEvent.type(
        screen.getByRole('textbox', {name: 'Redirect URL'}),
        'https://webhook.com/setup'
      );

      await userEvent.click(screen.getByRole('textbox', {name: 'Schema'}));
      await userEvent.paste('{}');
      await userEvent.click(screen.getByRole('checkbox', {name: 'Alert Rule Action'}));

      await selectEvent.select(screen.getByRole('textbox', {name: 'Member'}), 'Admin');
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Issue & Event'}),
        'Admin'
      );

      await userEvent.click(screen.getByRole('checkbox', {name: 'issue'}));

      await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

      const data = {
        name: 'Test App',
        author: 'Sentry',
        organization: OrganizationFixture().slug,
        redirectUrl: 'https://webhook.com/setup',
        webhookUrl: 'https://webhook.com',
        scopes: expect.arrayContaining([
          'member:read',
          'member:admin',
          'event:read',
          'event:admin',
        ]),
        events: ['issue'],
        isInternal: false,
        verifyInstall: true,
        isAlertable: true,
        allowedOrigins: [],
        schema: {},
      };

      expect(createAppRequest).toHaveBeenCalledWith(
        '/sentry-apps/',
        expect.objectContaining({
          data,
          method: 'POST',
        })
      );
    });
  });

  describe('Creating a new internal Sentry App', () => {
    window.location.pathname = 'new-internal/';

    function renderComponent() {
      const internalRouter = RouterFixture({
        location: LocationFixture({
          pathname: `/settings/developer-settings/new-internal/`,
        }),
      });
      return render(<SentryApplicationDetails />, {router: internalRouter});
    }

    it('does not show logo upload fields', function () {
      renderComponent();

      expect(screen.queryByText('Logo')).not.toBeInTheDocument();
      expect(screen.queryByText('Small Icon')).not.toBeInTheDocument();
    });

    it('no inputs for redirectUrl and verifyInstall', () => {
      renderComponent();

      expect(
        screen.queryByRole('checkbox', {name: 'Verify Installation'})
      ).not.toBeInTheDocument();

      expect(
        screen.queryByRole('textbox', {name: 'Redirect URL'})
      ).not.toBeInTheDocument();
    });
  });

  describe('Renders public app', function () {
    function renderComponent() {
      return render(<SentryApplicationDetails appSlug={sentryApp.slug} />);
    }

    beforeEach(() => {
      sentryApp = SentryAppFixture();
      sentryApp.events = ['issue'];

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [],
      });
    });

    it('shows logo upload fields', async function () {
      renderComponent();

      await screen.findAllByRole('button', {name: 'Save Changes'});
      expect(screen.getByText('Logo')).toBeInTheDocument();
      expect(screen.getByText('Small Icon')).toBeInTheDocument();
    });

    it('has inputs for redirectUrl and verifyInstall', async () => {
      renderComponent();

      await screen.findAllByRole('button', {name: 'Save Changes'});
      expect(
        screen.getByRole('checkbox', {name: 'Verify Installation'})
      ).toBeInTheDocument();

      expect(screen.getByRole('textbox', {name: 'Redirect URL'})).toBeInTheDocument();
    });

    it('shows application data', async function () {
      renderComponent();

      await screen.findAllByRole('button', {name: 'Save Changes'});
      await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Project'}));
      expect(screen.getByRole('menuitemradio', {name: 'Read'})).toBeChecked();
    });

    it('renders clientId and clientSecret for public apps', async function () {
      renderComponent();

      await screen.findAllByRole('button', {name: 'Save Changes'});
      expect(screen.getByRole('textbox', {name: 'Client ID'})).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Client Secret'})).toBeInTheDocument();
    });
  });

  describe('Renders for internal apps', () => {
    function renderComponent() {
      return render(<SentryApplicationDetails appSlug={sentryApp.slug} />);
    }

    beforeEach(() => {
      sentryApp = SentryAppFixture({
        status: 'internal',
      });
      token = SentryAppTokenFixture();
      sentryApp.events = ['issue'];

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [token],
      });
    });

    it('no inputs for redirectUrl and verifyInstall', async () => {
      renderComponent();

      await screen.findAllByRole('button', {name: 'Save Changes'});
      expect(
        screen.queryByRole('checkbox', {name: 'Verify Installation'})
      ).not.toBeInTheDocument();

      expect(
        screen.queryByRole('textbox', {name: 'Redirect URL'})
      ).not.toBeInTheDocument();
    });

    it('shows logo upload fields', async function () {
      renderComponent();

      await screen.findAllByRole('button', {name: 'Save Changes'});
      expect(screen.getByText('Logo')).toBeInTheDocument();
      expect(screen.getByText('Small Icon')).toBeInTheDocument();
    });

    it('has tokens', async function () {
      renderComponent();

      await screen.findAllByRole('button', {name: 'Save Changes'});
      expect(screen.getByText('Tokens')).toBeInTheDocument();
      expect(screen.getByLabelText('Token preview')).toHaveTextContent('oken');
    });

    it('shows just clientSecret', async function () {
      renderComponent();

      await screen.findAllByRole('button', {name: 'Save Changes'});
      expect(screen.queryByRole('textbox', {name: 'Client ID'})).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Client Secret'})).toBeInTheDocument();
    });
  });

  describe('Renders masked values', () => {
    function renderComponent() {
      return render(<SentryApplicationDetails appSlug={sentryApp.slug} />);
    }

    beforeEach(() => {
      sentryApp = SentryAppFixture({
        status: 'internal',
        clientSecret: maskedValue,
      });
      token = SentryAppTokenFixture({token: maskedValue, refreshToken: maskedValue});
      sentryApp.events = ['issue'];

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [token],
      });
    });

    it('shows masked tokens', async function () {
      renderComponent();

      await screen.findAllByRole('button', {name: 'Save Changes'});
      expect(screen.getByLabelText('Token preview')).toHaveTextContent(maskedValue);
    });

    it('shows masked clientSecret', async function () {
      renderComponent();

      await screen.findAllByRole('button', {name: 'Save Changes'});
      expect(screen.getByRole('textbox', {name: 'Client Secret'})).toHaveValue(
        maskedValue
      );
    });
  });

  describe('Editing internal app tokens', () => {
    function renderComponent() {
      return render(<SentryApplicationDetails appSlug={sentryApp.slug} />);
    }

    beforeEach(() => {
      sentryApp = SentryAppFixture({
        status: 'internal',
        isAlertable: true,
      });
      token = SentryAppTokenFixture();
      sentryApp.events = ['issue'];

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [token],
      });
    });

    it('adding token to list', async function () {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        method: 'POST',
        body: [
          SentryAppTokenFixture({
            token: '392847329',
            dateCreated: '2018-03-02T18:30:26Z',
            id: '234',
          }),
        ],
      });

      renderComponent();
      await screen.findAllByRole('button', {name: 'Save Changes'});
      expect(screen.queryByLabelText('Generated token')).not.toBeInTheDocument();
      expect(screen.getAllByLabelText('Token preview')).toHaveLength(1);

      await userEvent.click(screen.getByRole('button', {name: 'New Token'}));

      await waitFor(() => {
        expect(screen.getAllByLabelText('Token preview')).toHaveLength(1);
      });
      await waitFor(() => {
        expect(screen.getAllByLabelText('Generated token')).toHaveLength(1);
      });
    });

    it('removing token from list', async function () {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/${token.id}/`,
        method: 'DELETE',
        body: {},
      });

      renderComponent();
      renderGlobalModal();
      await screen.findByRole('button', {name: 'Save Changes'});
      await userEvent.click(screen.getByRole('button', {name: 'Remove'}));
      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));
      expect(await screen.findByText('No tokens created yet.')).toBeInTheDocument();
    });

    it('removing webhookURL unsets isAlertable and changes webhookDisabled to true', async () => {
      renderComponent();
      await screen.findByRole('button', {name: 'Save Changes'});
      expect(screen.getByRole('checkbox', {name: 'Alert Rule Action'})).toBeChecked();
      await userEvent.clear(screen.getByRole('textbox', {name: 'Webhook URL'}));
      expect(screen.getByRole('checkbox', {name: 'Alert Rule Action'})).not.toBeChecked();
    });
  });

  describe('Editing an existing public Sentry App', () => {
    function renderComponent() {
      return render(<SentryApplicationDetails appSlug={sentryApp.slug} />);
    }

    beforeEach(() => {
      sentryApp = SentryAppFixture();
      sentryApp.events = ['issue'];
      sentryApp.scopes = ['project:read', 'event:read'];

      editAppRequest = MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        method: 'PUT',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [],
      });
    });

    it('updates app with correct data', async function () {
      renderComponent();
      await screen.findByRole('button', {name: 'Save Changes'});
      await userEvent.clear(screen.getByRole('textbox', {name: 'Redirect URL'}));
      await userEvent.type(
        screen.getByRole('textbox', {name: 'Redirect URL'}),
        'https://hello.com/'
      );

      await userEvent.click(screen.getByRole('textbox', {name: 'Schema'}));
      await userEvent.paste('{}');

      await userEvent.click(screen.getByRole('checkbox', {name: 'issue'}));

      await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

      expect(editAppRequest).toHaveBeenCalledWith(
        `/sentry-apps/${sentryApp.slug}/`,
        expect.objectContaining({
          data: expect.objectContaining({
            redirectUrl: 'https://hello.com/',
            events: [],
          }),
          method: 'PUT',
        })
      );
    });

    it('submits with no-access for event subscription when permission is revoked', async () => {
      renderComponent();
      await screen.findByRole('button', {name: 'Save Changes'});
      await userEvent.click(screen.getByRole('checkbox', {name: 'issue'}));

      await userEvent.click(screen.getByRole('textbox', {name: 'Schema'}));
      await userEvent.paste('{}');

      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Issue & Event'}),
        'No Access'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

      expect(editAppRequest).toHaveBeenCalledWith(
        `/sentry-apps/${sentryApp.slug}/`,
        expect.objectContaining({
          data: expect.objectContaining({
            events: [],
          }),
          method: 'PUT',
        })
      );
    });
  });

  describe('Editing an existing public Sentry App with a scope error', () => {
    function renderComponent() {
      render(<SentryApplicationDetails appSlug={sentryApp.slug} />);
    }

    beforeEach(() => {
      sentryApp = SentryAppFixture();

      editAppRequest = MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        method: 'PUT',
        statusCode: 400,
        body: {
          scopes: [
            "Requested permission of member:write exceeds requester's permission. Please contact an administrator to make the requested change.",
            "Requested permission of member:admin exceeds requester's permission. Please contact an administrator to make the requested change.",
          ],
        },
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [],
      });
    });

    it('renders the error', async () => {
      renderComponent();
      await screen.findByRole('button', {name: 'Save Changes'});

      await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

      expect(
        await screen.findByText(
          "Requested permission of member:admin exceeds requester's permission. Please contact an administrator to make the requested change."
        )
      ).toBeInTheDocument();
    });

    it('handles client secret rotation', async function () {
      sentryApp = SentryAppFixture();
      sentryApp.clientSecret = undefined;

      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });
      const rotateSecretApiCall = MockApiClient.addMockResponse({
        method: 'POST',
        url: `/sentry-apps/${sentryApp.slug}/rotate-secret/`,
        body: {
          clientSecret: 'newSecret!',
        },
      });

      renderComponent();
      renderGlobalModal();

      await screen.findByRole('button', {name: 'Save Changes'});
      expect(screen.getByText('hidden')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Rotate client secret'})
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Rotate client secret'}));
      // Confirm modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(
        screen.getByText('This will be the only time your client secret is visible!')
      ).toBeInTheDocument();
      expect(screen.getByText('Your new Client Secret')).toBeInTheDocument();
      expect(screen.getByLabelText<HTMLInputElement>('new-client-secret')).toHaveValue(
        'newSecret!'
      );

      expect(rotateSecretApiCall).toHaveBeenCalledTimes(1);
    });
  });
});
