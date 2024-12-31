import {ConfigFixture} from 'sentry-fixture/config';
import {EventFixture} from 'sentry-fixture/event';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {EventAttachments} from 'sentry/components/events/eventAttachments';
import ConfigStore from 'sentry/stores/configStore';

describe('EventAttachments', function () {
  const {router, organization, project} = initializeOrg({
    organization: {
      features: ['event-attachments'],
      orgRole: 'member',
      attachmentsRole: 'member',
    },
  });
  const event = EventFixture({metadata: {stripped_crash: false}});

  const props = {
    group: undefined,
    project,
    event,
  };

  const attachmentsUrl = `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`;

  beforeEach(() => {
    ConfigStore.loadInitialData(ConfigFixture());
    MockApiClient.clearMockResponses();
  });

  it('shows attachments limit reached notice with stripped_crash: true', async function () {
    MockApiClient.addMockResponse({
      url: attachmentsUrl,
      body: [],
    });
    const strippedCrashEvent = {...event, metadata: {stripped_crash: true}};
    render(<EventAttachments {...props} event={strippedCrashEvent} />, {
      router,
      organization,
    });

    expect(await screen.findByText('Attachments (0)')).toBeInTheDocument();

    await tick();

    expect(screen.getByRole('link', {name: 'View crashes'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/1/attachments/?attachmentFilter=onlyCrash'
    );

    expect(screen.getByRole('link', {name: 'configure limit'})).toHaveAttribute(
      'href',
      `/settings/org-slug/projects/${project.slug}/security-and-privacy/`
    );

    expect(
      screen.getByText(
        'Your limit of stored crash reports has been reached for this issue.',
        {exact: false}
      )
    ).toBeInTheDocument();
  });

  it('does not render anything if no attachments (nor stripped) are available', async function () {
    MockApiClient.addMockResponse({
      url: attachmentsUrl,
      body: [],
    });
    const {container} = render(
      <EventAttachments
        {...props}
        event={{...event, metadata: {stripped_crash: false}}}
      />,
      {router, organization}
    );

    // No loading state to wait for
    await tick();

    expect(container).toBeEmptyDOMElement();
  });

  it('displays message when user lacks permission to preview an attachment', async function () {
    const {router: newRouter, organization: orgWithWrongAttachmentRole} = initializeOrg({
      organization: {
        features: ['event-attachments'],
        orgRole: 'member',
        attachmentsRole: 'admin',
      },
    });
    const attachment = EventAttachmentFixture({
      name: 'some_file.txt',
      headers: {
        'Content-Type': 'text/plain',
      },
      mimetype: 'text/plain',
      size: 100,
    });
    MockApiClient.addMockResponse({
      url: attachmentsUrl,
      body: [attachment],
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/events/${event.id}/attachments/?download`,
      body: 'file contents',
    });

    render(<EventAttachments {...props} />, {
      router: newRouter,
      organization: orgWithWrongAttachmentRole,
    });

    expect(await screen.findByText('Attachments (1)')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: /preview/i})).toBeDisabled();
    await userEvent.hover(screen.getByRole('button', {name: /preview/i}));

    await screen.findByText(/insufficient permissions to preview attachments/i);
  });

  it('can open attachment previews', async function () {
    const attachment = EventAttachmentFixture({
      name: 'some_file.txt',
      headers: {
        'Content-Type': 'text/plain',
      },
      mimetype: 'text/plain',
      size: 100,
    });
    MockApiClient.addMockResponse({
      url: attachmentsUrl,
      body: [attachment],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/1/?download`,
      body: 'file contents',
    });

    render(<EventAttachments {...props} />, {router, organization});

    expect(await screen.findByText('Attachments (1)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /preview/i}));

    expect(await screen.findByText('file contents')).toBeInTheDocument();
  });

  it('can delete attachments', async function () {
    const attachment1 = EventAttachmentFixture({
      id: '1',
      name: 'pic_1.png',
    });
    const attachment2 = EventAttachmentFixture({
      id: '2',
      name: 'pic_2.png',
    });
    MockApiClient.addMockResponse({
      url: attachmentsUrl,
      body: [attachment1, attachment2],
    });
    const deleteMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1/attachments/1/',
      method: 'DELETE',
    });

    render(<EventAttachments {...props} />, {router, organization});
    renderGlobalModal();

    expect(await screen.findByText('Attachments (2)')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', {name: 'Delete'})[0]);
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: /delete/i})
    );

    // Should make the delete request and remove the attachment optimistically
    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('pic_1.png')).not.toBeInTheDocument();
  });
});
