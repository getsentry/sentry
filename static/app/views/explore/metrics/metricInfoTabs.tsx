import {Fragment} from 'react';

import {Button} from 'sentry/components/core/button';
import {Flex, Stack} from 'sentry/components/core/layout';
import {TabList, TabPanels, TabStateProvider} from 'sentry/components/core/tabs';
import {Text} from 'sentry/components/core/text';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {IconFire, IconOpen, IconSpan, IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

enum MetricsInfoTab {
  AGGREGATES = 'aggregates',
  SAMPLES = 'samples',
  LOGS = 'logs',
  TRACES = 'traces',
}

interface TelemetryData {
  errors: number;
  logs: number;
  spans: number;
}

interface SampleRow {
  telemetry: TelemetryData;
  timestamp: string;
  traceId: string;
}

const FAKE_SAMPLE_DATA: SampleRow[] = [
  {
    telemetry: {errors: 3, logs: 1247, spans: 45},
    timestamp: '2024-10-10T14:32:15.123Z',
    traceId: 'abc123def456',
  },
  {
    telemetry: {errors: 0, logs: 892, spans: 23},
    timestamp: '2024-10-10T14:31:42.891Z',
    traceId: 'def456ghi789',
  },
  {
    telemetry: {errors: 12, logs: 2311, spans: 67},
    timestamp: '2024-10-10T14:30:58.567Z',
    traceId: 'ghi789jkl012',
  },
];

function TelemetryBubble({
  color,
  count,
  icon,
}: {
  color: 'red' | 'blue' | 'default';
  count: number;
  icon: React.ReactNode;
}) {
  const variantMap = {
    red: 'danger',
    blue: 'accent', 
    default: 'muted',
  } as const;

  return (
    <Flex align="center" gap="xs">
      <Text variant={variantMap[color]}>{icon}</Text>
      <Text size="sm" variant={variantMap[color]}>
        {formatAbbreviatedNumber(count)}
      </Text>
    </Flex>
  );
}

function SampleRowComponent({sample}: {sample: SampleRow}) {
  const timestamp = new Date(sample.timestamp).toLocaleTimeString();

  return (
    <Flex align="center" justify="between" padding="sm" gap="md">
      <Text
        size="sm"
        variant="muted"
        style={{
          paddingLeft: '16px',
        }}
      >
        {timestamp}
      </Text>
      <Flex align="center" gap="sm">
        <TelemetryBubble
          icon={<IconFire size="xs" />}
          count={sample.telemetry.errors}
          color="red"
        />
        <TelemetryBubble
          icon={<IconTerminal size="xs" />}
          count={sample.telemetry.logs}
          color="blue"
        />
        <TelemetryBubble
          icon={<IconSpan size="xs" />}
          count={sample.telemetry.spans}
          color="default"
        />
      </Flex>

      <Button size="xs" icon={<IconOpen />} priority="link">
        {t('Trace')}
      </Button>
    </Flex>
  );
}

export default function MetricInfoTabs() {
  return (
    <Fragment>
      <TabStateProvider<MetricsInfoTab> defaultValue={MetricsInfoTab.AGGREGATES}>
        <TabList>
          <TabList.Item key={MetricsInfoTab.AGGREGATES}>{t('Aggregates')}</TabList.Item>
          <TabList.Item key={MetricsInfoTab.SAMPLES}>{t('Samples')}</TabList.Item>
        </TabList>

        <TabPanels>
          <TabPanels.Item key={MetricsInfoTab.AGGREGATES}>
            <EmptyStateWarning>
              <p>{t('No aggregates data available')}</p>
            </EmptyStateWarning>
          </TabPanels.Item>
          <TabPanels.Item key={MetricsInfoTab.SAMPLES}>
            <Stack gap="xs">
              {FAKE_SAMPLE_DATA.map((sample, index) => (
                <SampleRowComponent key={index} sample={sample} />
              ))}
            </Stack>
          </TabPanels.Item>
        </TabPanels>
      </TabStateProvider>
    </Fragment>
  );
}
