import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import OrganizationDeveloperSettings from 'sentry/views/settings/organizationDeveloperSettings/index';

describe('Organization Developer Settings', function () {
  const {organization: org} = initializeOrg();
  const sentryApp = SentryAppFixture({
    scopes: [
      'team:read',
      'project:releases',
      'event:read',
      'event:write',
      'org:read',
      'org:write',
    ],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('when no Apps exist', () => {
    it('displays empty state', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [],
      });
      render(<OrganizationDeveloperSettings />);
      await waitFor(() => {
        expect(
          screen.getByText('No internal integrations have been created yet.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('with unpublished apps', () => {
    beforeEach(() => {
      const sentryAppWithAvatars = SentryAppFixture({
        avatars: [
          {
            avatarType: 'upload',
            avatarUuid: '1234561234561234561234567',
            avatarUrl: 'https://example.com/avatar/1234561234561234561234567/',
            color: true,
            photoType: 'logo',
          },
        ],
        scopes: [
          'team:read',
          'project:releases',
          'event:read',
          'event:write',
          'org:read',
          'org:write',
        ],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [sentryAppWithAvatars],
      });
    });

    it('internal integrations list is empty', async () => {
      render(<OrganizationDeveloperSettings />);
      expect(
        await screen.findByText('No internal integrations have been created yet.')
      ).toBeInTheDocument();
    });

    it('public integrations list contains 1 item', async () => {
      const router = RouterFixture({
        location: LocationFixture({query: {type: 'public'}}),
      });
      render(<OrganizationDeveloperSettings />, {
        router,
      });
      expect(await screen.findByText('Sample App')).toBeInTheDocument();
      expect(screen.getByText('unpublished')).toBeInTheDocument();
    });

    it('allows for deletion', async () => {
      MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        method: 'DELETE',
        body: [],
      });
      const router = RouterFixture({
        location: LocationFixture({query: {type: 'public'}}),
      });
      render(<OrganizationDeveloperSettings />, {
        router,
      });

      const deleteButton = await screen.findByRole('button', {name: 'Delete'});
      expect(deleteButton).toHaveAttribute('aria-disabled', 'false');

      await userEvent.click(deleteButton);
      renderGlobalModal();
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();

      const input = await within(dialog).findByPlaceholderText('sample-app');
      await userEvent.type(input, 'sample-app');
      const confirmDeleteButton = await screen.findByRole('button', {name: 'Confirm'});

      await userEvent.click(confirmDeleteButton);

      await screen.findByText('No public integrations have been created yet.');
    });

    it('can make a request to publish an integration', async () => {
      const mock = MockApiClient.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/publish-request/`,
        method: 'POST',
      });
      const router = RouterFixture({
        location: LocationFixture({query: {type: 'public'}}),
      });

      render(<OrganizationDeveloperSettings />, {
        router,
      });

      const publishButton = await screen.findByRole('button', {name: 'Publish'});

      expect(publishButton).toHaveAttribute('aria-disabled', 'false');
      await userEvent.click(publishButton);

      renderGlobalModal();
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      const questionnaire = [
        {
          answer: 'yep',
          question:
            'Provide a description about your integration, how this benefits developers using Sentry along with what’s needed to set up this integration.',
        },
        {
          answer: 'the coolest integration ever',
          question:
            'Provide a one-liner describing your integration. Subject to approval, we’ll use this to describe your integration on Sentry Integrations .',
        },
        {
          answer: 'https://example.com',
          question: 'Link to your documentation page.',
        },
        {
          answer: 'https://example.com',
          question:
            'Link to a video showing installation, setup and user flow for your submission.',
        },
        {
          answer: 'example@example.com',
          question: 'Email address for user support.',
        },
      ];
      await userEvent.click(
        screen.getByRole('textbox', {
          name: 'Select what category best describes your integration. Documentation for reference.',
        })
      );

      expect(screen.getByText('Deployment')).toBeInTheDocument();
      await userEvent.click(screen.getByText('Deployment'));

      for (const {question, answer} of questionnaire) {
        const element = within(dialog).getByRole('textbox', {name: question});
        await userEvent.type(element, answer);
      }

      const requestPublishButton =
        await within(dialog).findByLabelText('Request Publication');
      expect(requestPublishButton).toBeEnabled();

      await userEvent.click(requestPublishButton);

      expect(mock).toHaveBeenCalledTimes(1);
      const [url, {method, data}] = mock.mock.calls[0];
      expect(url).toBe(`/sentry-apps/${sentryApp.slug}/publish-request/`);
      expect(method).toBe('POST');
      expect(data).toEqual({
        questionnaire: expect.arrayContaining([
          {
            question:
              'Provide a description about your integration, how this benefits developers using Sentry along with what’s needed to set up this integration.',
            answer: 'yep',
          },
          {
            question:
              'Provide a one-liner describing your integration. Subject to approval, we’ll use this to describe your integration on Sentry Integrations.',
            answer: 'the coolest integration ever',
          },
          {
            question: 'Select what category best describes your integration.',
            answer: 'deployment',
          },
          {
            question: 'Link to your documentation page.',
            answer: 'https://example.com',
          },
          {
            question: 'Email address for user support.',
            answer: 'example@example.com',
          },
          {
            question:
              'Link to a video showing installation, setup and user flow for your submission.',
            answer: 'https://example.com',
          },
        ]),
      });
    });
  });

  describe('with published apps', () => {
    beforeEach(() => {
      const publishedSentryApp = SentryAppFixture({status: 'published'});
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [publishedSentryApp],
      });
    });
    it('shows the published status', async () => {
      const router = RouterFixture({
        location: LocationFixture({query: {type: 'public'}}),
      });
      render(<OrganizationDeveloperSettings />, {
        router,
      });
      expect(await screen.findByText('published')).toBeInTheDocument();
    });

    it('trash button is disabled', async () => {
      const router = RouterFixture({
        location: LocationFixture({query: {type: 'public'}}),
      });
      render(<OrganizationDeveloperSettings />, {
        router,
      });
      const deleteButton = await screen.findByRole('button', {name: 'Delete'});
      expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('publish button is disabled', async () => {
      const router = RouterFixture({
        location: LocationFixture({query: {type: 'public'}}),
      });
      render(<OrganizationDeveloperSettings />, {
        router,
      });
      const publishButton = await screen.findByRole('button', {name: 'Publish'});
      expect(publishButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('with Internal Integrations', () => {
    beforeEach(() => {
      const internalIntegration = SentryAppFixture({status: 'internal'});

      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [internalIntegration],
      });
    });

    it('allows deleting', async () => {
      render(<OrganizationDeveloperSettings />);
      const deleteButton = await screen.findByRole('button', {name: 'Delete'});
      expect(deleteButton).toHaveAttribute('aria-disabled', 'false');
    });

    it('publish button does not exist', () => {
      render(<OrganizationDeveloperSettings />);
      expect(screen.queryByText('Publish')).not.toBeInTheDocument();
    });
  });

  describe('without Owner permissions', () => {
    const newOrg = OrganizationFixture({access: ['org:read']});
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${newOrg.slug}/sentry-apps/`,
        body: [sentryApp],
      });
    });
    it('trash button is disabled', async () => {
      const router = RouterFixture({
        location: LocationFixture({query: {type: 'public'}}),
      });
      render(<OrganizationDeveloperSettings />, {
        router,
        organization: newOrg,
      });
      const deleteButton = await screen.findByRole('button', {name: 'Delete'});
      expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('publish button is disabled', async () => {
      const router = RouterFixture({
        location: LocationFixture({query: {type: 'public'}}),
      });
      render(<OrganizationDeveloperSettings />, {
        organization: newOrg,
        router,
      });
      const publishButton = await screen.findByRole('button', {name: 'Publish'});
      expect(publishButton).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
