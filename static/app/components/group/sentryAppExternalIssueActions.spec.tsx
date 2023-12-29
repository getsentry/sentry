import {Event as EventFixture} from 'sentry-fixture/event';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';
import {PlatformExternalIssue as PlatformExternalIssueFixture} from 'sentry-fixture/platformExternalIssue';
import {SentryApp} from 'sentry-fixture/sentryApp';
import {SentryAppComponent} from 'sentry-fixture/sentryAppComponent';
import {SentryAppInstallation} from 'sentry-fixture/sentryAppInstallation';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import SentryAppExternalIssueActions from 'sentry/components/group/sentryAppExternalIssueActions';

describe('SentryAppExternalIssueActions', () => {
  const group = GroupFixture();
  const sentryApp = SentryApp();
  const component = SentryAppComponent({
    sentryApp: {
      uuid: sentryApp.uuid,
      slug: sentryApp.slug,
      name: sentryApp.name,
    },
  });
  // unable to use the selectByValue here so remove the select option
  component.schema.create.required_fields.pop();
  const install = SentryAppInstallation({});
  const submitUrl = `/sentry-app-installations/${install.uuid}/external-issue-actions/`;
  const externalIssue = PlatformExternalIssueFixture({
    issueId: group.id,
    serviceType: component.sentryApp.slug,
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/interaction/`,
      method: 'POST',
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders without an external issue linked', async () => {
    render(
      <SentryAppExternalIssueActions
        event={EventFixture()}
        organization={Organization()}
        group={group}
        sentryAppInstallation={install}
        sentryAppComponent={component}
      />
    );
    renderGlobalModal();

    // Link to open the modal
    const link = screen.getByRole('link', {name: `${component.sentryApp.name} Issue`});
    expect(link).toBeInTheDocument();

    // Renders the add icon
    expect(screen.getByLabelText('Add')).toBeInTheDocument();

    // Open The Modal
    await userEvent.click(link);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // renders the Create Issue form fields, based on schema
    expect(component.schema.create.required_fields).toHaveLength(2);
    for (const field of component.schema.create.required_fields) {
      expect(screen.getByRole('textbox', {name: field.label})).toBeInTheDocument();
    }

    // Click the link tab
    await userEvent.click(screen.getByText('Link'));

    // renders the Link Issue form fields, based on schema
    expect(component.schema.link.required_fields).toHaveLength(1);
    for (const field of component.schema.link.required_fields) {
      expect(screen.getByRole('textbox', {name: field.label})).toBeInTheDocument();
    }
  });

  it('links to an existing Issue', async () => {
    const request = MockApiClient.addMockResponse({
      url: submitUrl,
      method: 'POST',
      body: externalIssue,
    });
    render(
      <SentryAppExternalIssueActions
        event={EventFixture()}
        organization={Organization()}
        group={group}
        sentryAppInstallation={install}
        sentryAppComponent={component}
      />
    );
    const {waitForModalToHide} = renderGlobalModal();

    // Open The Modal
    await userEvent.click(
      screen.getByRole('link', {name: `${component.sentryApp.name} Issue`})
    );

    // Click the link tab
    await userEvent.click(screen.getByText('Link'));

    await userEvent.type(screen.getByRole('textbox', {name: 'Issue'}), '99');
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitForModalToHide();

    expect(request).toHaveBeenCalledWith(
      submitUrl,
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'link',
          issue: '99',
          groupId: group.id,
        }),
      })
    );
  });

  it('creates a new Issue', async () => {
    const request = MockApiClient.addMockResponse({
      url: submitUrl,
      method: 'POST',
      body: externalIssue,
    });
    render(
      <SentryAppExternalIssueActions
        event={EventFixture()}
        organization={Organization()}
        group={group}
        sentryAppInstallation={install}
        sentryAppComponent={component}
      />
    );
    const {waitForModalToHide} = renderGlobalModal();

    // Open The Modal
    await userEvent.click(
      screen.getByRole('link', {name: `${component.sentryApp.name} Issue`})
    );

    await userEvent.clear(screen.getByRole('textbox', {name: 'Title'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'foo');

    await userEvent.clear(screen.getByRole('textbox', {name: 'Description'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Description'}), 'bar');

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitForModalToHide();

    expect(request).toHaveBeenCalledWith(
      submitUrl,
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'create',
          title: 'foo',
          description: 'bar',
          groupId: group.id,
        }),
      })
    );
  });

  it('renders with an external issue linked', () => {
    render(
      <SentryAppExternalIssueActions
        event={EventFixture()}
        organization={Organization()}
        group={group}
        sentryAppComponent={component}
        sentryAppInstallation={install}
        externalIssue={externalIssue}
      />
    );

    // Renders a link to the external issue
    const link = screen.getByRole('link', {name: externalIssue.displayName});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', externalIssue.webUrl);

    // Renders the remove issue button
    expect(screen.getByLabelText('Remove')).toBeInTheDocument();
  });

  it('deletes a Linked Issue', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/external-issues/${externalIssue.id}/`,
      method: 'DELETE',
    });
    render(
      <SentryAppExternalIssueActions
        event={EventFixture()}
        organization={Organization()}
        group={group}
        sentryAppComponent={component}
        sentryAppInstallation={install}
        externalIssue={externalIssue}
      />
    );

    await userEvent.click(screen.getByLabelText('Remove'));
    expect(request).toHaveBeenCalledTimes(1);
  });
});
