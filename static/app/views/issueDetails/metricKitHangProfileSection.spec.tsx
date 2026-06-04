import {FrameFixture} from 'sentry-fixture/frame';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  MetricKitHangProfileSection,
  type HangProfileData,
} from 'sentry/views/issueDetails/metricKitHangProfileSection';

jest.mock(
  'sentry/components/events/interfaces/crashContent/stackTrace/flamegraph',
  () => ({
    ...jest.requireActual(
      'sentry/components/events/interfaces/crashContent/stackTrace/flamegraph'
    ),
    StacktraceFlamegraph: jest.fn(() => <div data-test-id="flamegraph-preview" />),
  })
);

function makeHangProfileData(overrides: Partial<HangProfileData> = {}): HangProfileData {
  return {
    exceptionValue: 'MXHangDiagnostic hangDuration:2.5 s',
    frames: [
      FrameFixture({
        function: 'main',
        filename: 'main.m',
        inApp: true,
        parentIndex: -1,
        sampleCount: 10,
      }),
      FrameFixture({
        function: 'doWork',
        filename: 'worker.m',
        inApp: true,
        parentIndex: 0,
        sampleCount: 5,
      }),
    ],
    ...overrides,
  };
}

describe('MetricKitHangProfileSection', () => {
  const organization = OrganizationFixture();

  it('renders Hang Profile title and flamegraph', () => {
    const data = makeHangProfileData();

    render(<MetricKitHangProfileSection data={data} />, {organization});

    expect(screen.getByText('Hang Profile')).toBeInTheDocument();
    expect(screen.getByTestId('flamegraph-preview')).toBeInTheDocument();
  });

  it('displays exception value text above flamegraph', () => {
    const data = makeHangProfileData({
      exceptionValue: 'MXHangDiagnostic hangDuration:2.5 s',
    });

    render(<MetricKitHangProfileSection data={data} />, {organization});

    expect(screen.getByText('MXHangDiagnostic hangDuration:2.5 s')).toBeInTheDocument();
  });

  it('does not display exception value text when value is empty', () => {
    const data = makeHangProfileData({exceptionValue: ''});

    render(<MetricKitHangProfileSection data={data} />, {organization});

    expect(screen.getByText('Hang Profile')).toBeInTheDocument();
    expect(screen.getByTestId('flamegraph-preview')).toBeInTheDocument();
    expect(screen.queryByText('MXHangDiagnostic')).not.toBeInTheDocument();
  });

  it('shows tooltip explaining the hang profile', () => {
    const data = makeHangProfileData();

    render(<MetricKitHangProfileSection data={data} />, {organization});

    expect(screen.getByTestId('more-information')).toBeInTheDocument();
  });
});
