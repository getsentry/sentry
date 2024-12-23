import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {
  PerformanceScore,
  type VitalItem,
  type VitalStatus,
} from 'sentry/views/insights/mobile/screens/utils';

import {VitalDetailPanel} from './vitalDetailPanel';

jest.mock('sentry/views/insights/mobile/common/queries/useCrossPlatformProject', () => ({
  __esModule: true,
  default: () => ({selectedPlatform: 'Android'}),
}));

const mockStatus: VitalStatus = {
  formattedValue: '100ms',
  score: PerformanceScore.GOOD,
  description: 'Good performance',
  value: {
    type: 'duration',
    unit: 'ms',
    value: 100,
  },
};

const mockVital: VitalItem = {
  title: 'title',
  description: 'description',
  docs: 'docs',
  setup: 'setup',
  platformDocLinks: {
    Android: 'https://example.com/platform-docs',
  },
  sdkDocLinks: {
    Android: 'https://example.com/sdk-docs',
  },
  field: 'avg(measurements.app_start_cold)',
  dataset: DiscoverDatasets.METRICS,
  getStatus: () => mockStatus,
};

describe('VitalDetailPanel', () => {
  test('renders correctly with given props', () => {
    render(
      <PageAlertProvider>
        <VitalDetailPanel vital={mockVital} status={mockStatus} />
      </PageAlertProvider>
    );

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('100ms')).toBeInTheDocument();
    expect(screen.getByText('Good performance')).toBeInTheDocument();
    expect(screen.getByText('docs')).toBeInTheDocument();
    expect(screen.getByText('setup')).toBeInTheDocument();
    expect(screen.getByText('Sentry SDK documentation')).toHaveAttribute(
      'href',
      'https://example.com/sdk-docs'
    );
    expect(screen.getByText('Platform documentation')).toHaveAttribute(
      'href',
      'https://example.com/platform-docs'
    );
  });

  test('calls onClose when close action is triggered', async () => {
    const onCloseMock = jest.fn();
    render(
      <PageAlertProvider>
        <VitalDetailPanel vital={mockVital} status={mockStatus} />
      </PageAlertProvider>
    );

    const closeButton = screen.getByLabelText('Close Details');
    await userEvent.click(closeButton);
    expect(onCloseMock).toHaveBeenCalled();
  });
});
