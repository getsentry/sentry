import fetchMock from 'jest-fetch-mock';
import {EventFixture} from 'sentry-fixture/event';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LogFileViewer} from 'sentry/components/events/attachmentViewers/logFileViewer';

describe('LogFileViewer', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({organization});
  const event = EventFixture({project});
  const attachment = EventAttachmentFixture({
    event_id: event.id,
    name: 'crash-report.txt',
    mimetype: 'text/plain',
  });
  const attachmentUrl = `/api/0/projects/${organization.id}/${project.slug}/events/${event.id}/attachments/${attachment.id}/?download`;

  function ExampleLogFileViewer() {
    return (
      <LogFileViewer
        attachment={attachment}
        eventId={event.id}
        orgSlug={organization.id}
        projectSlug={project.slug}
      />
    );
  }

  afterEach(() => {
    fetchMock.resetMocks();
  });

  it('fetches raw attachment bytes and renders UTF-16 text', async () => {
    const bytes = new Uint8Array([
      0xff,
      0xfe, // UTF-16LE BOM
      0x41,
      0x00, // A
      0x2d,
      0x4e, // 中
    ]);
    fetchMock.route(attachmentUrl, fetchMock.Response(bytes));

    render(<ExampleLogFileViewer />);

    expect(await screen.findByText('A中')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      attachmentUrl,
      expect.objectContaining({
        credentials: 'include',
        headers: {Accept: '*/*'},
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('renders colored text without escape codes when given ANSI colors', async () => {
    fetchMock.route(
      attachmentUrl,
      fetchMock.Response(new TextEncoder().encode('\x1B[31mfailed\x1B[0m to connect'))
    );

    render(<ExampleLogFileViewer />);

    expect((await screen.findByText('failed')).style.color).toContain(
      'color-mix(in srgb,'
    );
    expect(screen.getByText('to connect')).toBeInTheDocument();
  });

  it('renders only the final write when given carriage-return progress updates', async () => {
    fetchMock.route(
      attachmentUrl,
      fetchMock.Response(new TextEncoder().encode('progress 10%\rprogress 100%'))
    );

    render(<ExampleLogFileViewer />);

    expect(await screen.findByText('progress 100%')).toBeInTheDocument();
  });

  it('renders an error when the attachment cannot be downloaded', async () => {
    fetchMock.route(attachmentUrl, '', {status: 404});

    render(<ExampleLogFileViewer />);

    expect(await screen.findByText('Failed to download attachment.')).toBeInTheDocument();
  });
});
