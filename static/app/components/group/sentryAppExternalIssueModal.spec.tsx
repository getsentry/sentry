import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PlatformExternalIssueFixture} from 'sentry-fixture/platformExternalIssue';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {SentryAppComponentFixture} from 'sentry-fixture/sentryAppComponent';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openSentryAppIssueModal} from 'sentry/components/group/sentryAppExternalIssueModal';

describe('openSentryAppIssueModal', () => {
  const group = GroupFixture();
  const sentryApp = SentryAppFixture();
  const component = SentryAppComponentFixture({
    sentryApp: {
      uuid: sentryApp.uuid,
      slug: sentryApp.slug,
      name: sentryApp.name,
    },
  });
  // unable to use the selectByValue here so remove the select option
  component.schema.create.required_fields.pop();
  const install = SentryAppInstallationFixture();
  const submitUrl = `/sentry-app-installations/${install.uuid}/external-issue-actions/`;
  const externalIssue = PlatformExternalIssueFixture({
    issueId: group.id,
    serviceType: component.sentryApp.slug,
  });
  const organization = OrganizationFixture();
  const event = EventFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/interaction/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/external-issues/`,
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders issue form fields, based on schema', async () => {
    // Open The Modal
    openSentryAppIssueModal({
      organization,
      group,
      event,
      sentryAppComponent: component,
      sentryAppInstallation: install,
    });

    renderGlobalModal();

    // renders the Create Issue form fields, based on schema
    await waitFor(() => {
      expect(component.schema.create.required_fields).toHaveLength(2);
    });
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

  it('can link an existing Issue', async () => {
    const request = MockApiClient.addMockResponse({
      url: submitUrl,
      method: 'POST',
      body: externalIssue,
    });
    openSentryAppIssueModal({
      organization,
      group,
      event,
      sentryAppComponent: component,
      sentryAppInstallation: install,
    });
    const {waitForModalToHide} = renderGlobalModal();

    // Click the link tab
    await userEvent.click(await screen.findByText('Link'));

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
    openSentryAppIssueModal({
      organization,
      group,
      event,
      sentryAppComponent: component,
      sentryAppInstallation: install,
    });
    const {waitForModalToHide} = renderGlobalModal();

    await userEvent.clear(await screen.findByRole('textbox', {name: 'Title'}));
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
});
