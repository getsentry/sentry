import {EventFixture} from 'sentry-fixture/event';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import JsonViewer from 'sentry/components/events/attachmentViewers/jsonViewer';

describe('JsonViewer', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({organization});
  const event = EventFixture({project});
  const attachment = EventAttachmentFixture({event_id: event.id});

  it('Renders error if fetch is not successful', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.id}/${project.slug}/events/${event.id}/attachments/${attachment.id}/?download`,
      status: 500,
      statusCode: 500,
    });

    render(
      <JsonViewer
        attachment={attachment}
        eventId={event.id}
        orgSlug={organization.id}
        projectSlug={project.slug}
      />
    );

    expect(await screen.findByText(/Failed to load attachment/)).toBeInTheDocument();
  });

  it('Renders JSON content if fetch is successful', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.id}/${project.slug}/events/${event.id}/attachments/${attachment.id}/?download`,
      body: '{"key":"value"}',
    });

    render(
      <JsonViewer
        attachment={attachment}
        eventId={event.id}
        orgSlug={organization.id}
        projectSlug={project.slug}
      />
    );

    expect(await screen.findByText('"key"')).toBeInTheDocument();
    expect(await screen.findByText('"value"')).toBeInTheDocument();
  });

  it('renders JSON sucessfully parsed by the api client', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.id}/${project.slug}/events/${event.id}/attachments/${attachment.id}/?download`,
      headers: {'content-type': 'application/json'},
      // Not a string, the mock api client will just return this object
      body: {key: 'value'},
    });

    render(
      <JsonViewer
        attachment={attachment}
        eventId={event.id}
        orgSlug={organization.id}
        projectSlug={project.slug}
      />
    );

    expect(await screen.findByText('"key"')).toBeInTheDocument();
    expect(await screen.findByText('"value"')).toBeInTheDocument();
  });
});
