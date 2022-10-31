import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import SentryAppExternalIssueActions from 'sentry/components/group/sentryAppExternalIssueActions';

describe('SentryAppExternalIssueActions', () => {
  const group = TestStubs.Group();
  const sentryApp = TestStubs.SentryApp();
  const component = TestStubs.SentryAppComponent({
    sentryApp: {
      uuid: sentryApp.uuid,
      slug: sentryApp.slug,
      name: sentryApp.name,
    },
  });
  // unable to use the selectByValue here so remove the select option
  component.schema.create.required_fields.pop();
  const install = TestStubs.SentryAppInstallation({sentryApp});
  const submitUrl = `/sentry-app-installations/${install.uuid}/external-issue-actions/`;
  const externalIssue = TestStubs.PlatformExternalIssue({
    groupId: group.id,
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

  it('renders without an external issue linked', () => {
    render(
      <SentryAppExternalIssueActions
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
    userEvent.click(link);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // renders the Create Issue form fields, based on schema
    expect(component.schema.create.required_fields).toHaveLength(2);
    for (const field of component.schema.create.required_fields) {
      expect(screen.getByRole('textbox', {name: field.label})).toBeInTheDocument();
    }

    // Click the link tab
    userEvent.click(screen.getByText('Link'));

    // renders the Link Issue form fields, based on schema
    expect(component.schema.link.required_fields).toHaveLength(1);
    for (const field of component.schema.link.required_fields) {
      expect(screen.getByRole('textbox', {name: field.label})).toBeInTheDocument();
    }
  });

  it('links to an existing Issue', () => {
    const request = MockApiClient.addMockResponse({
      url: submitUrl,
      method: 'POST',
      body: externalIssue,
    });
    render(
      <SentryAppExternalIssueActions
        group={group}
        sentryAppInstallation={install}
        sentryAppComponent={component}
      />
    );
    renderGlobalModal();

    // Open The Modal
    userEvent.click(
      screen.getByRole('link', {name: `${component.sentryApp.name} Issue`})
    );

    // Click the link tab
    userEvent.click(screen.getByText('Link'));

    userEvent.type(screen.getByRole('textbox', {name: 'Issue'}), '99');
    userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

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

  it('creates a new Issue', () => {
    const request = MockApiClient.addMockResponse({
      url: submitUrl,
      method: 'POST',
      body: externalIssue,
    });
    render(
      <SentryAppExternalIssueActions
        group={group}
        sentryAppInstallation={install}
        sentryAppComponent={component}
      />
    );
    renderGlobalModal();

    // Open The Modal
    userEvent.click(
      screen.getByRole('link', {name: `${component.sentryApp.name} Issue`})
    );

    userEvent.clear(screen.getByRole('textbox', {name: 'Title'}));
    userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'foo');

    userEvent.clear(screen.getByRole('textbox', {name: 'Description'}));
    userEvent.type(screen.getByRole('textbox', {name: 'Description'}), 'bar');

    userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

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

  it('deletes a Linked Issue', () => {
    const request = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/external-issues/${externalIssue.id}/`,
      method: 'DELETE',
    });
    render(
      <SentryAppExternalIssueActions
        group={group}
        sentryAppComponent={component}
        sentryAppInstallation={install}
        externalIssue={externalIssue}
      />
    );

    userEvent.click(screen.getByLabelText('Remove'));
    expect(request).toHaveBeenCalledTimes(1);
  });
});
