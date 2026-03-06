import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';
import {MetricKitHangProfileSection} from 'sentry/views/issueDetails/metricKitHangProfileSection';

jest.mock(
  'sentry/components/events/interfaces/crashContent/stackTrace/flamegraph',
  () => ({
    ...jest.requireActual(
      'sentry/components/events/interfaces/crashContent/stackTrace/flamegraph'
    ),
    StacktraceFlamegraph: jest.fn(() => <div data-test-id="flamegraph-preview" />),
  })
);

function makeExceptionEntry({
  value = 'MXHangDiagnostic hangDuration:2.5 s',
  withFlamegraphData = true,
}: {value?: string; withFlamegraphData?: boolean} = {}) {
  return {
    type: EntryType.EXCEPTION as const,
    data: {
      values: [
        {
          type: 'MXHangDiagnostic',
          value,
          stacktrace: {
            frames: [
              {
                function: 'main',
                filename: 'main.m',
                inApp: true,
                parentIndex: withFlamegraphData ? -1 : undefined,
                sampleCount: withFlamegraphData ? 10 : undefined,
              },
              {
                function: 'doWork',
                filename: 'worker.m',
                inApp: true,
                parentIndex: withFlamegraphData ? 0 : undefined,
                sampleCount: withFlamegraphData ? 5 : undefined,
              },
            ],
            framesOmitted: null,
            hasSystemFrames: false,
            registers: null,
          },
          rawStacktrace: null,
          mechanism: null,
          module: null,
          threadId: null,
        },
      ],
      hasSystemFrames: false,
      excOmitted: null,
    },
  };
}

describe('MetricKitHangProfileSection', () => {
  const organization = OrganizationFixture();

  it('does not render when event has no entries', () => {
    const event = EventFixture({entries: []});

    const {container} = render(<MetricKitHangProfileSection event={event} />, {
      organization,
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when frames do not have parentIndex', () => {
    const event = EventFixture({
      entries: [makeExceptionEntry({withFlamegraphData: false})],
    });

    const {container} = render(<MetricKitHangProfileSection event={event} />, {
      organization,
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders Hang Profile title and flamegraph when event has flamegraph data', () => {
    const event = EventFixture({
      entries: [makeExceptionEntry()],
    });

    render(<MetricKitHangProfileSection event={event} />, {organization});

    expect(screen.getByText('Hang Profile')).toBeInTheDocument();
    expect(screen.getByTestId('flamegraph-preview')).toBeInTheDocument();
  });

  it('displays exception value text above flamegraph', () => {
    const event = EventFixture({
      entries: [makeExceptionEntry({value: 'MXHangDiagnostic hangDuration:2.5 s'})],
    });

    render(<MetricKitHangProfileSection event={event} />, {organization});

    expect(screen.getByText('MXHangDiagnostic hangDuration:2.5 s')).toBeInTheDocument();
  });

  it('does not display exception value text when value is empty', () => {
    const event = EventFixture({
      entries: [
        {
          type: EntryType.STACKTRACE as const,
          data: {
            frames: [
              {
                function: 'main',
                filename: 'main.m',
                inApp: true,
                parentIndex: -1,
                sampleCount: 10,
              },
            ],
            framesOmitted: null,
            hasSystemFrames: false,
            registers: null,
          },
        },
      ],
    });

    render(<MetricKitHangProfileSection event={event} />, {organization});

    expect(screen.getByText('Hang Profile')).toBeInTheDocument();
    expect(screen.getByTestId('flamegraph-preview')).toBeInTheDocument();
    // No pre element with exception value should be rendered
    expect(screen.queryByText('MXHangDiagnostic')).not.toBeInTheDocument();
  });

  it('shows tooltip explaining the hang profile', () => {
    const event = EventFixture({
      entries: [makeExceptionEntry()],
    });

    render(<MetricKitHangProfileSection event={event} />, {organization});

    expect(screen.getByTestId('more-information')).toBeInTheDocument();
  });

  it('extracts flamegraph data from threads entry', () => {
    const event = EventFixture({
      entries: [
        {
          type: EntryType.THREADS as const,
          data: {
            values: [
              {
                id: 0,
                current: true,
                crashed: false,
                name: 'main',
                rawStacktrace: null,
                stacktrace: {
                  frames: [
                    {
                      function: 'main',
                      filename: 'main.m',
                      inApp: true,
                      parentIndex: -1,
                      sampleCount: 10,
                    },
                  ],
                  framesOmitted: null,
                  hasSystemFrames: false,
                  registers: null,
                },
              },
            ],
          },
        },
      ],
    });

    render(<MetricKitHangProfileSection event={event} />, {organization});

    expect(screen.getByText('Hang Profile')).toBeInTheDocument();
    expect(screen.getByTestId('flamegraph-preview')).toBeInTheDocument();
  });
});
