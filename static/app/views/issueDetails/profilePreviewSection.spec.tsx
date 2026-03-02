import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {ProfilePreviewSection} from 'sentry/views/issueDetails/profilePreviewSection';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';

const mockImportProfile = jest.fn();
const mockProfileGroup: ProfileGroup = {
  activeProfileIndex: 0,
  measurements: {},
  metadata: {},
  name: 'test-profile',
  profiles: [{} as ProfileGroup['profiles'][number]],
  traceID: 'trace-id',
  transactionID: 'transaction-id',
  type: 'transaction',
};

jest.mock('sentry/components/profiling/flamegraph/flamegraphPreview', () => ({
  FlamegraphPreview: jest.fn(() => <div data-test-id="flamegraph-preview" />),
}));

jest.mock('sentry/utils/profiling/flamegraph', () => ({
  Flamegraph: jest.fn(() => ({configSpace: {width: 100}})),
}));

jest.mock('sentry/utils/profiling/profile/importProfile', () => ({
  importProfile: () => mockImportProfile(),
}));

describe('ProfilePreviewSection', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({platform: 'android'});

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    // Expand the section by default
    localStorage.setItem(
      getFoldSectionKey(SectionKey.PROFILE_PREVIEW),
      JSON.stringify(false)
    );
    mockImportProfile.mockReturnValue(mockProfileGroup);
    jest.clearAllMocks();
  });

  afterEach(() => {
    localStorage.removeItem(getFoldSectionKey(SectionKey.PROFILE_PREVIEW));
  });

  it('does not render when event has no profiler_id', () => {
    const event = EventFixture({
      contexts: {},
      dateCreated: '2024-01-24T09:09:01+00:00',
      tags: [{key: 'mechanism', value: 'ANR'}],
    });

    const {container} = render(
      <ProfilePreviewSection event={event} project={project} />,
      {
        organization,
      }
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows an error message when profiles fail to load', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/chunks/`,
      body: {chunk: {}},
      statusCode: 500,
    });
    const event = EventFixture({
      contexts: {
        profile: {
          profiler_id: 'profiler-id',
        },
      },
      dateCreated: '2024-01-24T09:09:01+00:00',
      tags: [{key: 'mechanism', value: 'ANR'}],
    });

    render(<ProfilePreviewSection event={event} project={project} />, {organization});

    expect(
      await screen.findByText(
        "A performance profile was attached to this event, but it wasn't stored."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'This may be due to exceeding your profiling quota, or the profile being sampled out. Ensure your project has profiling quota to see flamegraphs for future events.'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'in our documentation'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/android/profiling/'
    );
  });

  it('renders flamegraph preview and open button once profiles are resolved', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/chunks/`,
      body: {chunk: {}},
    });
    const event = EventFixture({
      contexts: {
        profile: {
          profiler_id: 'profiler-id',
        },
      },
      dateCreated: '2024-01-24T09:09:01+00:00',
      tags: [{key: 'mechanism', value: 'ANR'}],
    });

    render(<ProfilePreviewSection event={event} project={project} />, {organization});

    expect(screen.getByText('ANR Profile')).toBeInTheDocument();
    expect(await screen.findByTestId('flamegraph-preview')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {
        name: 'Open in Profiling',
      })
    ).toBeInTheDocument();
  });

  it('renders App Hang Profile title for Apple platforms', async () => {
    const appleProject = ProjectFixture({platform: 'apple-ios'});
    ProjectsStore.loadInitialData([appleProject]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/chunks/`,
      body: {chunk: {}},
    });

    const event = EventFixture({
      contexts: {
        profile: {
          profiler_id: 'profiler-id',
        },
      },
      dateCreated: '2024-01-24T09:09:01+00:00',
      tags: [{key: 'mechanism', value: 'AppHang'}],
    });

    render(<ProfilePreviewSection event={event} project={appleProject} />, {
      organization,
    });

    expect(await screen.findByText('App Hang Profile')).toBeInTheDocument();
  });
});
