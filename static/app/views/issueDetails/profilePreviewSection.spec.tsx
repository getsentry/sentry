import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Flamegraph as FlamegraphMock} from 'sentry/utils/profiling/flamegraph';
import {ProfilePreviewSection} from 'sentry/views/issueDetails/profilePreviewSection';

let mockProfilesState: any;

jest.mock('sentry/views/issueDetails/utils', () => ({
  ...jest.requireActual('sentry/views/issueDetails/utils'),
  useHasStreamlinedUI: () => false,
}));

jest.mock('sentry/components/profiling/flamegraph/flamegraphPreview', () => ({
  FlamegraphPreview: jest.fn(() => <div data-test-id="flamegraph-preview" />),
}));

jest.mock('sentry/utils/profiling/flamegraph', () => ({
  Flamegraph: jest.fn().mockImplementation(() => ({
    configSpace: {width: 100},
  })),
}));

jest.mock('sentry/views/profiling/profileGroupProvider', () => {
  const React = require('react');

  const mockProfileGroup = {
    activeProfileIndex: 0,
    measurements: {},
    metadata: {},
    name: 'test-profile',
    profiles: [{}],
    traceID: 'trace-id',
    transactionID: 'transaction-id',
    type: 'transaction',
  };

  return {
    __esModule: true,
    ProfileGroupProvider: ({children}: {children: React.ReactNode}) => (
      <React.Fragment>{children}</React.Fragment>
    ),
    useProfileGroup: () => mockProfileGroup,
  };
});

jest.mock('sentry/views/profiling/profilesProvider', () => {
  const React = require('react');

  return {
    __esModule: true,
    ProfileContext: {
      Consumer: ({children}: {children: (value: any) => React.ReactNode}) =>
        children(mockProfilesState),
    },
    ProfilesProvider: ({children}: {children: React.ReactNode}) => (
      <React.Fragment>{children}</React.Fragment>
    ),
    useProfiles: () => mockProfilesState,
  };
});

describe('ProfilePreviewSection', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({platform: 'android'});

  beforeEach(() => {
    mockProfilesState = {type: 'initial'};
    (FlamegraphMock as any).mockClear();
  });

  it('does not render when event has no profiler_id', () => {
    const event = EventFixture({
      contexts: {},
      dateCreated: '2024-01-24T09:09:01+00:00',
      tags: [{key: 'mechanism', value: 'ANR'}],
    } as any);

    const {container} = render(
      <ProfilePreviewSection event={event} project={project} />,
      {
        organization,
      }
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows loading indicator while profiles are loading', () => {
    mockProfilesState = {type: 'loading'};

    const event = EventFixture({
      contexts: {
        profile: {
          profiler_id: 'profiler-id',
        },
      },
      dateCreated: '2024-01-24T09:09:01+00:00',
      tags: [{key: 'mechanism', value: 'ANR'}],
    } as any);

    render(<ProfilePreviewSection event={event} project={project} />, {organization});

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('shows an error message when profiles fail to load', () => {
    mockProfilesState = {type: 'errored', error: 'Failed to fetch profiles'};

    const event = EventFixture({
      contexts: {
        profile: {
          profiler_id: 'profiler-id',
        },
      },
      dateCreated: '2024-01-24T09:09:01+00:00',
      tags: [{key: 'mechanism', value: 'ANR'}],
    } as any);

    render(<ProfilePreviewSection event={event} project={project} />, {organization});

    expect(
      screen.getByText(
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

  it('renders flamegraph preview and open button once profiles are resolved', () => {
    mockProfilesState = {
      type: 'resolved',
      data: {chunk: {}},
    };

    const event = EventFixture({
      contexts: {
        profile: {
          profiler_id: 'profiler-id',
        },
      },
      dateCreated: '2024-01-24T09:09:01+00:00',
      tags: [{key: 'mechanism', value: 'ANR'}],
    } as any);

    render(<ProfilePreviewSection event={event} project={project} />, {organization});

    expect(screen.getByText('ANR Profile')).toBeInTheDocument();
    expect(screen.getByTestId('flamegraph-preview')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Open in Profiling',
      })
    ).toBeInTheDocument();
  });

  it('renders App Hang Profile title for Apple platforms', () => {
    const appleProject = ProjectFixture({platform: 'apple-ios'});
    mockProfilesState = {
      type: 'resolved',
      data: {chunk: {}},
    };

    const event = EventFixture({
      contexts: {
        profile: {
          profiler_id: 'profiler-id',
        },
      },
      dateCreated: '2024-01-24T09:09:01+00:00',
      tags: [{key: 'mechanism', value: 'AppHang'}],
    } as any);

    render(<ProfilePreviewSection event={event} project={appleProject} />, {
      organization,
    });

    expect(screen.getByText('App Hang Profile')).toBeInTheDocument();
  });
});
