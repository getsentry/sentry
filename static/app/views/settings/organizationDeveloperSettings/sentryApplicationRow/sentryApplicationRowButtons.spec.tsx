import {OrganizationFixture} from 'sentry-fixture/organization';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SentryApplicationRowButtons from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationRow/sentryApplicationRowButtons';

describe('Sentry App Row Buttons', function () {
  const removeApp = jest.fn();
  const publishApp = jest.fn();
  const sentryApp = SentryAppFixture();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', async () => {
    render(
      <SentryApplicationRowButtons
        organization={OrganizationFixture()}
        app={sentryApp}
        onClickRemove={removeApp}
        onClickPublish={publishApp}
      />
    );

    const publishButton = await screen.findByRole('button', {name: 'Publish'});
    expect(publishButton).toHaveAttribute('aria-disabled', 'false');
    await userEvent.hover(publishButton);

    const deleteButton = await screen.findByRole('button', {name: 'Delete'});
    expect(deleteButton).toHaveAttribute('aria-disabled', 'false');

    const dashboardButton = await screen.findByRole('button', {name: 'Dashboard'});
    expect(dashboardButton).toHaveAttribute('aria-disabled', 'false');
  });

  it('hides the publish button if the app is internal', async () => {
    const internalSentryApp = SentryAppFixture({status: 'internal'});
    render(
      <SentryApplicationRowButtons
        organization={OrganizationFixture()}
        app={internalSentryApp}
        onClickRemove={removeApp}
        onClickPublish={publishApp}
      />
    );

    expect(screen.queryByText('Publish')).not.toBeInTheDocument();

    const deleteButton = await screen.findByRole('button', {name: 'Delete'});
    expect(deleteButton).toHaveAttribute('aria-disabled', 'false');

    const dashboardButton = await screen.findByRole('button', {name: 'Dashboard'});
    expect(dashboardButton).toHaveAttribute('aria-disabled', 'false');
  });

  it('disables the delete and publish button if the app is published', async () => {
    const internalSentryApp = SentryAppFixture({status: 'published'});
    render(
      <SentryApplicationRowButtons
        organization={OrganizationFixture()}
        app={internalSentryApp}
        onClickRemove={removeApp}
        onClickPublish={publishApp}
      />
    );
    const publishButton = await screen.findByRole('button', {name: 'Publish'});
    expect(publishButton).toHaveAttribute('aria-disabled', 'true');

    const deleteButton = await screen.findByRole('button', {name: 'Delete'});
    expect(deleteButton).toHaveAttribute('aria-disabled', 'true');

    const dashboardButton = await screen.findByRole('button', {name: 'Dashboard'});
    expect(dashboardButton).toHaveAttribute('aria-disabled', 'false');
  });

  it('disables the publish button if the sentry app has a UI feature and no icon', async () => {
    const organization = OrganizationFixture({
      features: [`streamlined-publishing-flow`],
    });

    const internalSentryApp = SentryAppFixture({
      status: 'unpublished',
      avatars: [
        {
          avatarType: 'upload',
          avatarUuid: '1234561234561234561234567',
          avatarUrl: 'https://example.com/avatar/1234561234561234561234567/',
          color: true,
          photoType: 'logo',
        },
        {
          avatarType: 'default',
          avatarUuid: '1234561234561234561234567',
          avatarUrl: 'https://example.com/avatar/1234561234561234561234567/',
          color: false,
          photoType: 'icon',
        },
      ],
      schema: {
        elements: [
          {
            type: 'issue-link',
            create: {
              uri: '/api/sentry/issue-link/create/',
              required_fields: [
                {
                  type: 'text',
                  label: 'Task Name',
                  name: 'title',
                  default: 'issue.title',
                },
              ],
            },
            link: {
              uri: '/api/sentry/issue-link/link/',
              required_fields: [
                {
                  type: 'select',
                  label: 'Which task would you like to link to this Sentry Issue?',
                  name: 'itemId',
                  uri: '/api/sentry/options/items/',
                },
              ],
            },
          },
        ],
      },
    });
    render(
      <SentryApplicationRowButtons
        organization={organization}
        app={internalSentryApp}
        onClickRemove={removeApp}
        onClickPublish={publishApp}
      />
    );

    const publishButton = await screen.findByRole('button', {name: 'Publish'});
    expect(publishButton).toHaveAttribute('aria-disabled', 'true');

    const deleteButton = await screen.findByRole('button', {name: 'Delete'});
    expect(deleteButton).toHaveAttribute('aria-disabled', 'false');

    const dashboardButton = await screen.findByRole('button', {name: 'Dashboard'});
    expect(dashboardButton).toHaveAttribute('aria-disabled', 'false');
  });

  it('disables the publish button if the app is in progress of publishing', async () => {
    const organization = OrganizationFixture({
      features: [`streamlined-publishing-flow`],
    });
    const internalSentryApp = SentryAppFixture({status: 'publish_request_inprogress'});

    render(
      <SentryApplicationRowButtons
        organization={organization}
        app={internalSentryApp}
        onClickRemove={removeApp}
        onClickPublish={publishApp}
      />
    );

    const publishButton = await screen.findByRole('button', {name: 'Publish'});
    expect(publishButton).toHaveAttribute('aria-disabled', 'true');

    const deleteButton = await screen.findByRole('button', {name: 'Delete'});
    expect(deleteButton).toHaveAttribute('aria-disabled', 'false');

    const dashboardButton = await screen.findByRole('button', {name: 'Dashboard'});
    expect(dashboardButton).toHaveAttribute('aria-disabled', 'false');
  });
});
