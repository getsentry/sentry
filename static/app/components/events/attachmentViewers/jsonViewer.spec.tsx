import {Event} from 'sentry-fixture/event';
import {EventAttachment} from 'sentry-fixture/eventAttachment';
import {Organization} from 'sentry-fixture/organization';
import {Project} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import JsonViewer from 'sentry/components/events/attachmentViewers/jsonViewer';

describe('JsonViewer', () => {
  const organization = Organization();
  const project = Project({organization});
  const event = Event({project});
  const attachment = EventAttachment({event_id: event.id});

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
        orgId={organization.id}
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
        orgId={organization.id}
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
        orgId={organization.id}
        projectSlug={project.slug}
      />
    );

    expect(await screen.findByText('"key"')).toBeInTheDocument();
    expect(await screen.findByText('"value"')).toBeInTheDocument();
  });
});
