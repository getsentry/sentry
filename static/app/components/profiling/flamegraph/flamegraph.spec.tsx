import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useParams} from 'sentry/utils/useParams';
import ProfileFlamegraph from 'sentry/views/profiling/profileFlamechart';
import ProfilesAndTransactionProvider from 'sentry/views/profiling/transactionProfileProvider';

jest.mock('sentry/utils/useParams', () => ({
  useParams: jest.fn(),
}));

window.ResizeObserver =
  window.ResizeObserver ||
  jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));

Element.prototype.scrollTo = () => {};

// Replace the webgl renderer with a dom renderer for tests
jest.mock('sentry/utils/profiling/renderers/flamegraphRendererWebGL', () => {
  const {
    FlamegraphRendererDOM,
  } = require('sentry/utils/profiling/renderers/flamegraphRendererDOM');

  return {
    FlamegraphRendererWebGL: FlamegraphRendererDOM,
  };
});

const flamechart = {
  debug_meta: {
    images: [
      {
        code_file: '/Users/jonasbadalic/code/node-profiler-test/dist/esbuild/index.js',
        debug_id: 'f1ee474a-d90f-4efd-7617-881e3dd98dfa',
        type: 'sourcemap',
      },
    ],
  },
  device: {
    architecture: 'arm64',
    classification: '',
    locale: 'en_US.UTF-8',
    manufacturer: 'Darwin',
    model: 'arm64',
  },
  environment: 'production',
  event_id: 'a1f7cc43c19e4343874ab3c8a683518f',
  os: {
    build_number:
      'Darwin Kernel Version 22.3.0: Thu Jan  5 20:48:54 PST 2023; root:xnu-8792.81.2~2/RELEASE_ARM64_T6000',
    name: 'darwin',
    version: '22.3.0',
  },
  organization_id: 1078604,
  platform: 'node',
  project_id: 4505125986435072,
  received: '2023-05-16T13:15:16Z',
  release: '',
  retention_days: 30,
  runtime: {name: 'node', version: '16.16.0'},
  timestamp: '2023-05-16T13:15:15.468Z',
  profile: {
    frames: [{data: {}, function: 'profiling transaction', in_app: false}],
    queue_metadata: null,
    samples: [
      {elapsed_since_start_ns: 84000, stack_id: 0, thread_id: 0},
      {elapsed_since_start_ns: 13959000, stack_id: 1, thread_id: 0},
    ],
    stacks: [[0], [0]],
    thread_metadata: {'0': {name: 'main'}},
  },
  transaction: {
    active_thread_id: 0,
    id: 'e1357065eb2242338f8dbf19b64f59af',
    name: 'sourcemaps here',
    trace_id: '3e47880eac4948a694cd6a5822ed4e95',
  },
  transaction_metadata: {
    environment: 'production',
    transaction: 'sourcemaps here',
    'transaction.end': '2023-05-16T13:15:16.470000028Z',
    'transaction.op': 'test',
    'transaction.start': '2023-05-16T13:15:15.467999935Z',
    'transaction.status': 'unknown',
  },
  transaction_tags: {server_name: 'TK6G745PW1.local'},
  version: '1',
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('Flamegraph', function () {
  beforeEach(() => {
    const project = ProjectFixture({slug: 'foo-project'});
    act(() => void ProjectsStore.loadInitialData([project]));
  });
  it('renders a missing profile', async function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/foo-project/profiling/profiles/profile-id/',
      statusCode: 404,
    });

    jest.mocked(useParams).mockReturnValue({
      orgId: 'org-slug',
      projectId: 'foo-project',
      eventId: 'profile-id',
    });

    render(
      <ProfilesAndTransactionProvider>
        <ProfileFlamegraph />
      </ProfilesAndTransactionProvider>,
      {organization: initializeOrg().organization}
    );

    expect(await screen.findByText('Error: Unable to load profiles')).toBeInTheDocument();
  });

  it('renders a profile', async function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/foo-project/profiling/profiles/profile-id/',
      body: flamechart,
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/foo-project/events/${flamechart.transaction.id}/`,
      statusCode: 404,
    });

    jest.mocked(useParams).mockReturnValue({
      orgId: 'org-slug',
      projectId: 'foo-project',
      eventId: 'profile-id',
    });

    render(
      <ProfilesAndTransactionProvider>
        <ProfileFlamegraph />
      </ProfilesAndTransactionProvider>,
      {organization: initializeOrg().organization}
    );

    const frames = await screen.findAllByTestId('flamegraph-frame', undefined, {
      timeout: 5000,
    });

    // 1 for main view and 1 for minimap
    expect(frames).toHaveLength(2);
  });

  it('reads preferences from qs', async function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/foo-project/profiling/profiles/profile-id/',
      body: flamechart,
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/foo-project/events/${flamechart.transaction.id}/`,
      statusCode: 404,
    });

    jest.mocked(useParams).mockReturnValue({
      orgId: 'org-slug',
      projectId: 'foo-project',
      eventId: 'profile-id',
    });

    window.location.search =
      '?colorCoding=by+library&query=&sorting=alphabetical&tid=0&view=bottom+up';

    render(
      <ProfilesAndTransactionProvider>
        <ProfileFlamegraph />
      </ProfilesAndTransactionProvider>,
      {organization: initializeOrg().organization}
    );

    expect(await screen.findByRole('radio', {name: 'Alphabetical'})).toBeChecked();
    expect(await screen.findByRole('radio', {name: 'Bottom Up'})).toBeChecked();

    await userEvent.click(screen.getByText('Color Coding'));
    expect(await screen.findByRole('option', {name: 'By Package'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('populates search query and performs search', async function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/foo-project/profiling/profiles/profile-id/',
      body: flamechart,
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/foo-project/events/${flamechart.transaction.id}/`,
      statusCode: 404,
    });

    jest.mocked(useParams).mockReturnValue({
      orgId: 'org-slug',
      projectId: 'foo-project',
      eventId: 'profile-id',
    });

    window.location.search = '?query=profiling+transaction';

    render(
      <ProfilesAndTransactionProvider>
        <ProfileFlamegraph />
      </ProfilesAndTransactionProvider>,
      {organization: initializeOrg().organization}
    );

    expect(await screen.findByPlaceholderText('Find Frames')).toHaveValue(
      'profiling transaction'
    );
  });
});
