import {EventFixture} from 'sentry-fixture/event';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {EventFlamegraph} from './eventFlamegraph';

const organization = OrganizationFixture({
  features: ['event-attachments', 'flamegraph-attachments'],
});
const event = EventFixture();
const project = ProjectFixture();
const attachment = EventAttachmentFixture({
  type: 'event.flamegraph',
  name: 'flamegraph.json',
});
const listUrl = `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`;
const downloadUrl = `/projects/${organization.slug}/${project.slug}/events/${attachment.event_id}/attachments/${attachment.id}/`;
const diagnostic = {
  version: '1',
  platform: 'cocoa',
  frames: [{function: 'main', instruction_addr: '0x1000', in_app: true}],
  trees: [
    {roots: [{frame_id: 0, sample_count: 10}]},
    {thread_id: '7', roots: [{frame_id: 0, sample_count: 3}]},
  ],
};

describe('Event flamegraph', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({url: listUrl, body: [attachment]});
    MockApiClient.addMockResponse({
      url: downloadUrl,
      body: diagnostic,
      match: [MockApiClient.matchQuery({download: true})],
    });
  });

  it('renders the downloaded attachment with independent tree selection', async () => {
    render(<EventFlamegraph event={event} project={project} />, {organization});
    expect(await screen.findByRole('region', {name: 'Flamegraph'})).toBeInTheDocument();
    expect(await screen.findByText('10 samples')).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Flamegraph for Tree 1'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('textbox', {name: 'Call tree'}));
    await userEvent.click(screen.getByText('Tree 2 · Thread 7'));
    expect(await screen.findByText('3 samples')).toBeInTheDocument();
  });

  it('treats unclassified frames as system frames', async () => {
    MockApiClient.addMockResponse({
      url: downloadUrl,
      body: {...diagnostic, frames: [{instruction_addr: '0x1000'}]},
    });
    render(<EventFlamegraph event={event} project={project} />, {organization});
    expect(await screen.findByText('10 samples')).toBeInTheDocument();
    expect(screen.getByText('System Function')).toBeInTheDocument();
    expect(screen.queryByText('System or Unclassified Function')).not.toBeInTheDocument();
  });

  it('accepts string JSON downloads', async () => {
    MockApiClient.addMockResponse({url: downloadUrl, body: JSON.stringify(diagnostic)});
    render(<EventFlamegraph event={event} project={project} />, {organization});
    expect(await screen.findByText('10 samples')).toBeInTheDocument();
  });

  it('renders nothing when there is no flamegraph attachment', async () => {
    const list = MockApiClient.addMockResponse({
      url: listUrl,
      body: [EventAttachmentFixture()],
    });
    render(<EventFlamegraph event={event} project={project} />, {organization});
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('region', {name: 'Flamegraph'})).not.toBeInTheDocument();
  });

  it('does not fetch attachments when the feature is disabled', () => {
    const list = MockApiClient.addMockResponse({url: listUrl, body: [attachment]});
    const {container} = render(<EventFlamegraph event={event} project={project} />, {
      organization: OrganizationFixture({features: ['event-attachments']}),
    });
    expect(container).toBeEmptyDOMElement();
    expect(list).not.toHaveBeenCalled();
  });

  it('offers an explicit retry when downloading fails', async () => {
    const download = MockApiClient.addMockResponse({
      url: downloadUrl,
      statusCode: 500,
      body: {detail: 'Flamegraph attachment unavailable.'},
    });
    render(<EventFlamegraph event={event} project={project} />, {organization});
    expect(
      await screen.findByText('Flamegraph attachment unavailable.')
    ).toBeInTheDocument();
    expect(download).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  });

  it('shows an unsupported-version message without rendering a graph', async () => {
    MockApiClient.addMockResponse({
      url: downloadUrl,
      body: {...diagnostic, version: '2'},
    });
    render(<EventFlamegraph event={event} project={project} />, {organization});
    expect(
      await screen.findByText('This flamegraph attachment version is not supported.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', {name: 'Flamegraph for Tree 1'})
    ).not.toBeInTheDocument();
  });

  it('keeps multiple flamegraph attachments separate', async () => {
    const second = EventAttachmentFixture({
      id: '99',
      type: 'event.flamegraph',
      name: 'second.json',
    });
    MockApiClient.addMockResponse({url: listUrl, body: [attachment, second]});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${second.event_id}/attachments/${second.id}/`,
      body: {...diagnostic, trees: [{roots: [{frame_id: 0, sample_count: 2}]}]},
    });
    render(<EventFlamegraph event={event} project={project} />, {organization});
    expect(await screen.findByText('10 samples')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('textbox', {name: 'Flamegraph attachment'}));
    await userEvent.click(screen.getByText('second.json'));
    expect(await screen.findByText('2 samples')).toBeInTheDocument();
  });
});
