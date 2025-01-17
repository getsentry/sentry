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
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [sentryApp],
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
          answer: 'Answer 0',
          question: 'What does your integration do? Please be as detailed as possible.',
        },
        {answer: 'Answer 1', question: 'What value does it offer customers?'},
        {
          answer: 'Answer 2',
          question: 'Do you operate the web service your integration communicates with?',
        },
        {
          answer: 'Answer 3',
          question:
            'Please justify why you are requesting each of the following permissions: Team Read, Release Admin, Event Write, Organization Write.',
        },
      ];

      for (const {question, answer} of questionnaire) {
        const element = within(dialog).getByRole('textbox', {name: question});
        await userEvent.type(element, answer);
      }

      const requestPublishButton =
        await within(dialog).findByLabelText('Request Publication');
      expect(requestPublishButton).toHaveAttribute('aria-disabled', 'false');

      await userEvent.click(requestPublishButton);

      expect(mock).toHaveBeenCalledWith(
        `/sentry-apps/${sentryApp.slug}/publish-request/`,
        expect.objectContaining({
          data: {questionnaire},
        })
      );
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
