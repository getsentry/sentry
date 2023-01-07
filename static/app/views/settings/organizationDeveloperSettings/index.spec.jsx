import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import OrganizationDeveloperSettings from 'sentry/views/settings/organizationDeveloperSettings/index';

describe('Organization Developer Settings', function () {
  const org = TestStubs.Organization();
  const sentryApp = TestStubs.SentryApp({
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
    Client.clearMockResponses();
  });

  describe('when no Apps exist', () => {
    it('displays empty state', async () => {
      Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [],
      });
      const {container} = render(<OrganizationDeveloperSettings organization={org} />);
      await waitFor(() => {
        expect(
          screen.getByText('No internal integrations have been created yet.')
        ).toBeInTheDocument();
      });
      expect(container).toSnapshot();
    });
  });

  describe('with unpublished apps', () => {
    beforeEach(() => {
      Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [sentryApp],
      });
    });

    it('internal integrations list is empty', () => {
      render(<OrganizationDeveloperSettings organization={org} />, {organization: org});
      expect(
        screen.getByText('No internal integrations have been created yet.')
      ).toBeInTheDocument();
    });

    it('public integrations list contains 1 item', () => {
      render(
        <OrganizationDeveloperSettings
          organization={org}
          location={{query: {type: 'public'}}}
        />,
        {organization: org}
      );
      expect(screen.getByText('Sample App')).toBeInTheDocument();
      expect(screen.getByText('unpublished')).toBeInTheDocument();
    });

    it('allows for deletion', async () => {
      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        method: 'DELETE',
        body: [],
      });
      render(
        <OrganizationDeveloperSettings
          organization={org}
          location={{query: {type: 'public'}}}
        />
      );

      const deleteButton = await screen.findByRole('button', {name: 'Delete'});
      expect(deleteButton).toHaveAttribute('aria-disabled', 'false');

      userEvent.click(deleteButton);
      renderGlobalModal();
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();

      const input = await within(dialog).findByPlaceholderText('sample-app');
      userEvent.paste(input, 'sample-app');
      const confirmDeleteButton = await screen.findByRole('button', {name: 'Confirm'});

      userEvent.click(confirmDeleteButton);

      await screen.findByText('No public integrations have been created yet.');
    });

    it('can make a request to publish an integration', async () => {
      const mock = Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/publish-request/`,
        method: 'POST',
      });

      render(
        <OrganizationDeveloperSettings
          organization={org}
          location={{query: {type: 'public'}}}
        />
      );

      const publishButton = await screen.findByRole('button', {name: 'Publish'});

      expect(publishButton).toHaveAttribute('aria-disabled', 'false');
      userEvent.click(publishButton);

      const {waitForModalToHide} = renderGlobalModal();
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
        userEvent.paste(element, answer);
      }

      const requestPublishButton = await within(dialog).findByLabelText(
        'Request Publication'
      );
      expect(requestPublishButton).toHaveAttribute('aria-disabled', 'false');

      userEvent.click(requestPublishButton);

      await waitForModalToHide();

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
      const publishedSentryApp = TestStubs.SentryApp({status: 'published'});
      Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [publishedSentryApp],
      });
    });
    it('shows the published status', () => {
      render(
        <OrganizationDeveloperSettings
          organization={org}
          location={{query: {type: 'public'}}}
        />
      );
      expect(screen.getByText('published')).toBeInTheDocument();
    });

    it('trash button is disabled', async () => {
      render(
        <OrganizationDeveloperSettings
          organization={org}
          location={{query: {type: 'public'}}}
        />
      );
      const deleteButton = await screen.findByRole('button', {name: 'Delete'});
      expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('publish button is disabled', async () => {
      render(
        <OrganizationDeveloperSettings
          organization={org}
          location={{query: {type: 'public'}}}
        />
      );
      const publishButton = await screen.findByRole('button', {name: 'Publish'});
      expect(publishButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('with Internal Integrations', () => {
    beforeEach(() => {
      const internalIntegration = TestStubs.SentryApp({status: 'internal'});

      Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [internalIntegration],
      });
    });

    it('allows deleting', async () => {
      render(<OrganizationDeveloperSettings organization={org} />);
      const deleteButton = await screen.findByRole('button', {name: 'Delete'});
      expect(deleteButton).toHaveAttribute('aria-disabled', 'false');
    });

    it('publish button does not exist', () => {
      render(<OrganizationDeveloperSettings organization={org} />);
      expect(screen.queryByText('Publish')).not.toBeInTheDocument();
    });
  });

  describe('without Owner permissions', () => {
    const newOrg = TestStubs.Organization({access: ['org:read']});
    beforeEach(() => {
      Client.addMockResponse({
        url: `/organizations/${newOrg.slug}/sentry-apps/`,
        body: [sentryApp],
      });
    });
    it('trash button is disabled', async () => {
      render(
        <OrganizationDeveloperSettings
          organization={newOrg}
          location={{query: {type: 'public'}}}
        />
      );
      const deleteButton = await screen.findByRole('button', {name: 'Delete'});
      expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('publish button is disabled', async () => {
      render(
        <OrganizationDeveloperSettings
          organization={newOrg}
          location={{query: {type: 'public'}}}
        />
      );
      const publishButton = await screen.findByRole('button', {name: 'Publish'});
      expect(publishButton).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
