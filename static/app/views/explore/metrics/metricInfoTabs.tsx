import {Fragment} from 'react';

import {Button} from 'sentry/components/core/button';
import {Flex, Stack} from 'sentry/components/core/layout';
import {TabList, TabPanels, TabStateProvider} from 'sentry/components/core/tabs';
import {Text} from 'sentry/components/core/text';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
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
  value: number;
}

const FAKE_SAMPLE_DATA: SampleRow[] = [
  {
    telemetry: {errors: 3, logs: 1247, spans: 45},
    timestamp: '2024-10-10T14:32:15.123Z',
    traceId: 'abc123def456',
    value: 2.845,
  },
  {
    telemetry: {errors: 0, logs: 892, spans: 23},
    timestamp: '2024-10-10T14:31:42.891Z',
    traceId: 'def456ghi789',
    value: 1.923,
  },
  {
    telemetry: {errors: 12, logs: 2311, spans: 67},
    timestamp: '2024-10-10T14:30:58.567Z',
    traceId: 'ghi789jkl012',
    value: 3.672,
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
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Text size="sm" variant="muted">
          {timestamp}
        </Text>
      </SimpleTable.RowCell>
      
      <SimpleTable.RowCell>
        <Text size="sm">
          {sample.value.toFixed(3)}s
        </Text>
      </SimpleTable.RowCell>
      
      <SimpleTable.RowCell>
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
          <Button size="xs" icon={<IconOpen />} priority="link">
            {t('Trace')}
          </Button>
        </Flex>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
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
            <SimpleTable style={{gridTemplateColumns: '1fr 1fr 2fr'}}>
              <SimpleTable.Header>
                <SimpleTable.HeaderCell>{t('Timestamp')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Value')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Trace')}</SimpleTable.HeaderCell>
              </SimpleTable.Header>
              {FAKE_SAMPLE_DATA.map((sample, index) => (
                <SampleRowComponent key={index} sample={sample} />
              ))}
            </SimpleTable>
          </TabPanels.Item>
        </TabPanels>
      </TabStateProvider>
    </Fragment>
  );
}
