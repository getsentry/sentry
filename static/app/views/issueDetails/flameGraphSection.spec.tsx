import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {FlameGraphSection} from 'sentry/views/issueDetails/flameGraphSection';

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

describe('FlameGraphSection', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    mockProfilesState = {type: 'initial'};
  });

  it('does not render when event has no profiler_id', () => {
    const event = EventFixture({
      contexts: {},
      dateCreated: '2024-01-24T09:09:01+00:00',
    } as any);

    const {container} = render(<FlameGraphSection event={event} project={project} />, {
      organization,
    });

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
    } as any);

    render(<FlameGraphSection event={event} project={project} />, {organization});

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
    } as any);

    render(<FlameGraphSection event={event} project={project} />, {organization});

    expect(
      screen.getByText(
        'We couldn’t load the profile attached to this event. It may have been sampled out.'
      )
    ).toBeInTheDocument();
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
    } as any);

    render(<FlameGraphSection event={event} project={project} />, {organization});

    expect(screen.getByText('Aggregated Flamegraph')).toBeInTheDocument();
    expect(screen.getByTestId('flamegraph-preview')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Open in Profiling',
      })
    ).toBeInTheDocument();
  });
});
