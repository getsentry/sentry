import selectEvent from 'react-select-event';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import SentryApplicationDetails from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails';

describe('Sentry Application Details', function () {
  let org;
  let orgId;
  let sentryApp;
  let token;
  let createAppRequest;
  let editAppRequest;

  const maskedValue = '*'.repeat(64);

  beforeEach(() => {
    Client.clearMockResponses();

    org = TestStubs.Organization({features: ['sentry-app-logo-upload']});
    orgId = org.slug;
  });

  describe('Creating a new public Sentry App', () => {
    function renderComponent() {
      return render(
        <SentryApplicationDetails params={{orgId}} route={{path: 'new-public/'}} />,
        {context: TestStubs.routerContext([{organization: org}])}
      );
    }

    beforeEach(() => {
      createAppRequest = Client.addMockResponse({
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

      userEvent.paste(screen.getByRole('textbox', {name: 'Name'}), 'Test App');
      userEvent.paste(screen.getByRole('textbox', {name: 'Author'}), 'Sentry');

      userEvent.paste(
        screen.getByRole('textbox', {name: 'Webhook URL'}),
        'https://webhook.com'
      );

      userEvent.paste(
        screen.getByRole('textbox', {name: 'Redirect URL'}),
        'https://webhook.com/setup'
      );

      userEvent.paste(screen.getByRole('textbox', {name: 'Schema'}), '{}');
      userEvent.click(screen.getByRole('checkbox', {name: 'Alert Rule Action'}));

      await selectEvent.select(screen.getByRole('textbox', {name: 'Member'}), 'Admin');
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Issue & Event'}),
        'Admin'
      );

      userEvent.click(screen.getByRole('checkbox', {name: 'issue'}));

      userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

      const data = {
        name: 'Test App',
        author: 'Sentry',
        organization: org.slug,
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
    function renderComponent() {
      return render(
        <SentryApplicationDetails params={{orgId}} route={{path: 'new-internal/'}} />,
        {context: TestStubs.routerContext([{organization: org}])}
      );
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
      return render(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        {
          context: TestStubs.routerContext([{organization: org}]),
        }
      );
    }

    beforeEach(() => {
      sentryApp = TestStubs.SentryApp();
      sentryApp.events = ['issue'];

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [],
      });
    });

    it('shows logo upload fields', function () {
      renderComponent();

      expect(screen.getByText('Logo')).toBeInTheDocument();
      expect(screen.getByText('Small Icon')).toBeInTheDocument();
    });

    it('has inputs for redirectUrl and verifyInstall', () => {
      renderComponent();

      expect(
        screen.getByRole('checkbox', {name: 'Verify Installation'})
      ).toBeInTheDocument();

      expect(screen.getByRole('textbox', {name: 'Redirect URL'})).toBeInTheDocument();
    });

    it('shows application data', function () {
      renderComponent();

      selectEvent.openMenu(screen.getByRole('textbox', {name: 'Project'}));
      expect(screen.getByRole('menuitemradio', {name: 'Read'})).toBeChecked();
    });

    it('renders clientId and clientSecret for public apps', function () {
      renderComponent();

      expect(screen.getByRole('textbox', {name: 'Client ID'})).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Client Secret'})).toBeInTheDocument();
    });
  });

  describe('Renders for internal apps', () => {
    function renderComponent() {
      return render(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        {
          context: TestStubs.routerContext([{organization: org}]),
        }
      );
    }

    beforeEach(() => {
      sentryApp = TestStubs.SentryApp({
        status: 'internal',
      });
      token = TestStubs.SentryAppToken();
      sentryApp.events = ['issue'];

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [token],
      });
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

    it('shows logo upload fields', function () {
      renderComponent();

      expect(screen.getByText('Logo')).toBeInTheDocument();
      expect(screen.getByText('Small Icon')).toBeInTheDocument();
    });

    it('shows tokens', function () {
      renderComponent();

      expect(screen.getByText('Tokens')).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Token value'})).toHaveValue(
        '123456123456123456123456-token'
      );
    });

    it('shows just clientSecret', function () {
      renderComponent();

      expect(screen.queryByRole('textbox', {name: 'Client ID'})).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'Client Secret'})).toBeInTheDocument();
    });
  });

  describe('Renders masked values', () => {
    function renderComponent() {
      return render(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        {
          context: TestStubs.routerContext([{organization: org}]),
        }
      );
    }

    beforeEach(() => {
      sentryApp = TestStubs.SentryApp({
        status: 'internal',
        clientSecret: maskedValue,
      });
      token = TestStubs.SentryAppToken({token: maskedValue, refreshToken: maskedValue});
      sentryApp.events = ['issue'];

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [token],
      });
    });

    it('shows masked tokens', function () {
      renderComponent();
      expect(screen.getByRole('textbox', {name: 'Token value'})).toHaveValue(maskedValue);
    });

    it('shows masked clientSecret', function () {
      renderComponent();
      expect(screen.getByRole('textbox', {name: 'Client Secret'})).toHaveValue(
        maskedValue
      );
    });
  });

  describe('Editing internal app tokens', () => {
    function renderComponent() {
      return render(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        {
          context: TestStubs.routerContext([{organization: org}]),
        }
      );
    }

    beforeEach(() => {
      sentryApp = TestStubs.SentryApp({
        status: 'internal',
        isAlertable: true,
      });
      token = TestStubs.SentryAppToken();
      sentryApp.events = ['issue'];

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [token],
      });
    });

    it('adding token to list', async function () {
      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        method: 'POST',
        body: [
          TestStubs.SentryAppToken({
            token: '392847329',
            dateCreated: '2018-03-02T18:30:26Z',
          }),
        ],
      });

      renderComponent();
      userEvent.click(screen.getByRole('button', {name: 'New Token'}));

      await waitFor(() => {
        expect(screen.getAllByRole('textbox', {name: 'Token value'})).toHaveLength(2);
      });
    });

    it('removing token from list', async function () {
      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/${token.token}/`,
        method: 'DELETE',
        body: {},
      });

      renderComponent();
      userEvent.click(screen.getByRole('button', {name: 'Revoke'}));
      expect(await screen.findByText('No tokens created yet.')).toBeInTheDocument();
    });

    it('removing webhookURL unsets isAlertable and changes webhookDisabled to true', () => {
      renderComponent();

      expect(screen.getByRole('checkbox', {name: 'Alert Rule Action'})).toBeChecked();
      userEvent.clear(screen.getByRole('textbox', {name: 'Webhook URL'}), '');
      expect(screen.getByRole('checkbox', {name: 'Alert Rule Action'})).not.toBeChecked();
    });
  });

  describe('Editing an existing public Sentry App', () => {
    function renderComponent() {
      return render(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        {
          context: TestStubs.routerContext([{organization: org}]),
        }
      );
    }

    beforeEach(() => {
      sentryApp = TestStubs.SentryApp();
      sentryApp.events = ['issue'];
      sentryApp.scopes = ['project:read', 'event:read'];

      editAppRequest = Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        method: 'PUT',
        body: [],
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [],
      });
    });

    it('updates app with correct data', function () {
      renderComponent();

      userEvent.clear(screen.getByRole('textbox', {name: 'Redirect URL'}));
      userEvent.paste(
        screen.getByRole('textbox', {name: 'Redirect URL'}),
        'https://hello.com/'
      );

      userEvent.paste(screen.getByRole('textbox', {name: 'Schema'}), '{}');

      userEvent.click(screen.getByRole('checkbox', {name: 'issue'}));

      userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

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

      userEvent.click(screen.getByRole('checkbox', {name: 'issue'}));

      userEvent.paste(screen.getByRole('textbox', {name: 'Schema'}), '{}');

      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Issue & Event'}),
        'No Access'
      );

      userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

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
      render(<SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />, {
        context: TestStubs.routerContext([{organization: org}]),
      });
    }

    beforeEach(() => {
      sentryApp = TestStubs.SentryApp();

      editAppRequest = Client.addMockResponse({
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

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [],
      });
    });

    it('renders the error', async () => {
      renderComponent();

      userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

      expect(
        await screen.findByText(
          "Requested permission of member:admin exceeds requester's permission. Please contact an administrator to make the requested change."
        )
      ).toBeInTheDocument();
    });
  });
});
