import {Event as EventFixture} from 'sentry-fixture/event';
import {EventAttachment} from 'sentry-fixture/eventAttachment';

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

describe('EventAttachments', function () {
  const {routerContext, organization, project} = initializeOrg({
    organization: {
      features: ['event-attachments'],
      orgRole: 'member',
      attachmentsRole: 'member',
    },
  } as any);
  const event = EventFixture({metadata: {stripped_crash: false}});

  const props = {
    projectSlug: project.slug,
    event,
  };

  const attachmentsUrl = `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows attachments limit reached notice with stripped_crash: true', async function () {
    MockApiClient.addMockResponse({
      url: attachmentsUrl,
      body: [],
    });
    const strippedCrashEvent = {...event, metadata: {stripped_crash: true}};
    render(<EventAttachments {...props} event={strippedCrashEvent} />, {
      context: routerContext,
      organization,
    });

    expect(await screen.findByText('Attachments (0)')).toBeInTheDocument();

    await tick();

    expect(screen.getByRole('link', {name: 'View crashes'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/1/attachments/?types=event.minidump&types=event.applecrashreport'
    );

    expect(screen.getByRole('link', {name: 'configure limit'})).toHaveAttribute(
      'href',
      `/settings/org-slug/projects/${props.projectSlug}/security-and-privacy/`
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
      {context: routerContext, organization}
    );

    // No loading state to wait for
    await tick();

    expect(container).toBeEmptyDOMElement();
  });

  it('displays message when user lacks permission to preview an attachment', async function () {
    const {routerContext: newRouterContext, organization: orgWithWrongAttachmentRole} =
      initializeOrg({
        organization: {
          features: ['event-attachments'],
          orgRole: 'member',
          attachmentsRole: 'admin',
        },
      } as any);
    const attachment = EventAttachment({
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
      context: newRouterContext,
      organization: orgWithWrongAttachmentRole,
    });

    expect(await screen.findByText('Attachments (1)')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: /preview/i})).toBeDisabled();
    await userEvent.hover(screen.getByRole('button', {name: /preview/i}));

    await screen.findByText(/insufficient permissions to preview attachments/i);
  });

  it('can open attachment previews', async function () {
    const attachment = EventAttachment({
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
      url: '/projects/org-slug/project-slug/events/1/attachments/1/?download',
      body: 'file contents',
    });

    render(<EventAttachments {...props} />, {context: routerContext, organization});

    expect(await screen.findByText('Attachments (1)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /preview/i}));

    expect(screen.getByText('file contents')).toBeInTheDocument();
  });

  it('can delete attachments', async function () {
    const attachment1 = EventAttachment({
      id: '1',
      name: 'pic_1.png',
    });
    const attachment2 = EventAttachment({
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

    render(<EventAttachments {...props} />, {context: routerContext, organization});
    renderGlobalModal();

    expect(await screen.findByText('Attachments (2)')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', {name: 'Delete'})[0]);
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: /delete/i})
    );

    // Should make the delete request and remove the attachment optimistically
    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
      expect(screen.queryByTestId('pic_1.png')).not.toBeInTheDocument();
    });
  });
});
