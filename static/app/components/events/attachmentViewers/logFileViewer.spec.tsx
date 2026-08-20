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
    name: 'cpp_crash_report_utf16.txt',
    mimetype: 'text/plain',
    headers: {'Content-Type': 'text/plain'},
  });

  it('renders UTF-16LE Chinese text instead of mojibake', async () => {
    const text = '时间: UTF-16 附件\n异常: std::runtime_error';
    const body = new Uint8Array([0xff, 0xfe, ...utf16leBytes(text)]);

    MockApiClient.addMockResponse({
      url: `/projects/${organization.id}/${project.slug}/events/${event.id}/attachments/${attachment.id}/`,
      body,
      headers: {'Content-Type': 'text/plain'},
      match: [MockApiClient.matchQuery({download: true})],
    });

    render(
      <LogFileViewer
        attachment={attachment}
        eventId={event.id}
        orgSlug={organization.id}
        projectSlug={project.slug}
      />
    );

    expect(await screen.findByText(/时间: UTF-16 附件/)).toBeInTheDocument();
    expect(screen.getByText(/std::runtime_error/)).toBeInTheDocument();
    expect(screen.queryByText(/æ/)).not.toBeInTheDocument();
  });
});

function utf16leBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes.push(code & 0xff, code >> 8);
  }
  return bytes;
}
