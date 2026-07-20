import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProfileChunkAttachmentsButton} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/profileChunkAttachmentsButton';
import {ProjectsStore} from 'sentry/stores/projectsStore';

const PROFILER_ID = 'abfecec9b81a401fa26705dc595814ba';

function makeAttachment(overrides = {}) {
  return {
    id: '1',
    profilerId: PROFILER_ID,
    chunkId: '11111111111111111111111111111111',
    name: 'trace.perfetto',
    contentType: 'application/x-perfetto-trace',
    dateAdded: '2024-01-02T03:04:05Z',
    ...overrides,
  };
}

describe('ProfileChunkAttachmentsButton', () => {
  const {organization, project} = initializeOrg({
    organization: {orgRole: 'member', attachmentsRole: 'member'},
  });

  const attachmentsUrl = `/organizations/${organization.slug}/profiling/chunk-attachments/`;

  const routerConfig = {
    location: {
      pathname: `/profiling/${project.slug}/`,
      query: {
        profilerId: PROFILER_ID,
        start: '2024-01-02T03:00:00Z',
        end: '2024-01-02T04:00:00Z',
      },
    },
    route: '/profiling/:projectId/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  it('renders nothing when there are no attachments', async () => {
    const request = MockApiClient.addMockResponse({url: attachmentsUrl, body: []});

    const {container} = render(<ProfileChunkAttachmentsButton />, {
      organization,
      initialRouterConfig: routerConfig,
    });

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('downloads a single attachment from the dropdown', async () => {
    MockApiClient.addMockResponse({url: attachmentsUrl, body: [makeAttachment()]});

    render(<ProfileChunkAttachmentsButton />, {
      organization,
      initialRouterConfig: routerConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Download'}));

    expect(
      await screen.findByRole('menuitemradio', {name: 'Perfetto Trace'})
    ).toHaveAttribute(
      'href',
      `/api/0/projects/${organization.slug}/${project.slug}/profiling/chunks/${PROFILER_ID}/11111111111111111111111111111111/attachments/1/?download=1`
    );
  });

  it('labels attachments by chunk and content type', async () => {
    MockApiClient.addMockResponse({
      url: attachmentsUrl,
      body: [
        makeAttachment({id: '1', name: 'system.perfetto'}),
        makeAttachment({
          id: '2',
          name: 'thread.json',
          chunkId: '22222',
          contentType: 'application/json',
        }),
      ],
    });

    render(<ProfileChunkAttachmentsButton />, {
      organization,
      initialRouterConfig: routerConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Download'}));

    // Items are labeled by content type, with "<chunkId> / <name>" as a detail.
    expect(
      await screen.findByRole('menuitemradio', {name: 'Perfetto Trace'})
    ).toHaveAttribute(
      'href',
      `/api/0/projects/${organization.slug}/${project.slug}/profiling/chunks/${PROFILER_ID}/11111111111111111111111111111111/attachments/1/?download=1`
    );
    expect(
      screen.getByText('11111111111111111111111111111111 / system.perfetto')
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Attachment'})).toBeInTheDocument();
    expect(screen.getByText('22222 / thread.json')).toBeInTheDocument();
  });

  it('disables download when the viewer lacks the attachments role', async () => {
    const restrictedOrg = initializeOrg({
      organization: {orgRole: 'member', attachmentsRole: 'owner'},
    }).organization;
    MockApiClient.addMockResponse({url: attachmentsUrl, body: [makeAttachment()]});

    render(<ProfileChunkAttachmentsButton />, {
      organization: restrictedOrg,
      initialRouterConfig: routerConfig,
    });

    expect(await screen.findByRole('button', {name: 'Download'})).toBeDisabled();
  });
});
