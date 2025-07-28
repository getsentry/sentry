import {EventFixture} from 'sentry-fixture/event';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {InlineEventAttachment} from 'sentry/views/issueDetails/groupEventAttachments/inlineEventAttachment';

describe('InlineEventAttachment', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const event = EventFixture();

  it('renders rrweb viewer for rrweb.json attachment', function () {
    const attachment = EventAttachmentFixture({
      name: 'rrweb.json',
      mimetype: 'application/json',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.slug}/events/${event.id}/attachments/${attachment.id}/?download`,
      body: '{"events": []}',
    });

    render(
      <InlineEventAttachment
        attachment={attachment}
        projectSlug={project.slug}
        eventId={event.id}
      />
    );

    expect(
      screen.getByText(/This is an attachment containing a session replay/)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View the replay'})).toBeInTheDocument();
  });

  it('renders rrweb viewer for rrweb- prefixed attachment', function () {
    const attachment = EventAttachmentFixture({
      name: 'rrweb-12345.json',
      mimetype: 'application/json',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.slug}/events/${event.id}/attachments/${attachment.id}/?download`,
      body: '{"events": []}',
    });

    render(
      <InlineEventAttachment
        attachment={attachment}
        projectSlug={project.slug}
        eventId={event.id}
      />
    );

    expect(
      screen.getByText(/This is an attachment containing a session replay/)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View the replay'})).toBeInTheDocument();
  });
});
