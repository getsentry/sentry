import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import {getInterval} from 'sentry/components/charts/utils';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import Switch from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {Organization, SelectValue} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {TOP_EVENT_MODES} from 'sentry/utils/discover/types';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';

import {usesTransactionsDataset} from './utils';

type Props = {
  displayMode: string;
  displayOptions: SelectValue<string>[];
  eventView: EventView;
  onAxisChange: (value: string[]) => void;
  onDisplayChange: (value: string) => void;
  onIntervalChange: (value: string) => void;
  onTopEventsChange: (value: string) => void;
  organization: Organization;
  setShowBaseline: (value: boolean) => void;
  showBaseline: boolean;
  topEvents: string;
  total: number | null;
  yAxisOptions: SelectValue<string>[];
  yAxisValue: string[];
};

export default function ChartFooter({
  total,
  yAxisValue,
  yAxisOptions,
  onAxisChange,
  displayMode,
  displayOptions,
  onDisplayChange,
  onTopEventsChange,
  onIntervalChange,
  topEvents,
  setShowBaseline,
  showBaseline,
  organization,
  eventView,
}: Props) {
  const metricsCardinality = useMetricsCardinalityContext();
  const elements: React.ReactNode[] = [];

  elements.push(<SectionHeading key="total-label">{t('Total Events')}</SectionHeading>);
  elements.push(
    total === null ? (
      <SectionValue data-test-id="loading-placeholder" key="total-value">
        &mdash;
      </SectionValue>
    ) : (
      <SectionValue key="total-value">{total.toLocaleString()}</SectionValue>
    )
  );
  const topEventOptions: SelectValue<string>[] = [];
  for (let i = 1; i <= 10; i++) {
    topEventOptions.push({value: i.toString(), label: i.toString()});
  }

  const intervalOptionMap = [
    {
      rangeStart: 90,
      min: 60 * 60,
      default: '4h',
      options: ['30m', '1h', '4h', '1d', '5d'],
    },
    {
      rangeStart: 30,
      min: 60 * 30,
      default: '1h',
      options: ['30m', '1h', '4h', '1d', '5d'],
    },
    {
      rangeStart: 14,
      min: 60 * 10,
      default: '30m',
      options: ['30m', '1h', '4h', '1d'],
    },
    {
      rangeStart: 7,
      min: 60 * 5,
      default: '30m',
      options: ['30m', '1h', '4h', '1d'],
    },
    {
      rangeStart: 1, // 1 day
      min: 60,
      default: '5m',
      options: ['5m', '15m', '1h'],
    },
    {
      rangeStart: 1 / 24, // 1 hour
      min: 1,
      default: '1m',
      options: ['1m', '5m', '15m'],
    },
    {
      rangeStart: 1 / 24 / 60, // 1 minute
      min: 1,
      default: '1s',
      options: ['1s', '5s', '30s'],
    },
  ];
  let intervalOption = intervalOptionMap[0];
  let interval =
    eventView.interval ?? getInterval(eventView.getPageFilters().datetime, 'high');
  const days = eventView.getDays();
  const intervalHours = parsePeriodToHours(interval);
  const optionMax = days / 2;
  for (const index in intervalOptionMap) {
    const currentOption = intervalOptionMap[index];
    if (currentOption.rangeStart <= days) {
      intervalOption = currentOption;
      break;
    }
  }
  if (intervalHours * 3600 < intervalOption.min) {
    interval = intervalOption.default;
    onIntervalChange(interval);
  } else if (intervalHours > optionMax * 24) {
    if (optionMax > 1) {
      interval = `${optionMax}d`;
    } else if (optionMax > 1 / 24) {
      interval = `${optionMax / 24}h`;
    } else {
      interval = `${optionMax / 24 / 60}m`;
    }
    onIntervalChange(interval);
  }

  return (
    <ChartControls>
      <InlineContainer>{elements}</InlineContainer>
      <InlineContainer>
        <Feature organization={organization} features={['discover-metrics-baseline']}>
          <Fragment>
            <SwitchLabel>{t('Processed events')}</SwitchLabel>
            <Switch
              data-test-id="processed-events-toggle"
              isActive={showBaseline}
              isDisabled={
                metricsCardinality.outcome?.forceTransactionsOnly ||
                displayMode !== 'default' ||
                !usesTransactionsDataset(eventView, yAxisValue)
              }
              size="lg"
              toggle={() => setShowBaseline(!showBaseline)}
            />
          </Fragment>
        </Feature>
        <DropdownAutoComplete
          onSelect={item => onIntervalChange(item.value)}
          items={intervalOption.options.map(option => ({
            value: option,
            searchKey: option,
            label: option,
          }))}
          alignMenu="right"
        >
          {({isOpen}) => (
            <DropdownButton borderless prefix={t('Interval')} isOpen={isOpen}>
              {interval}
            </DropdownButton>
          )}
        </DropdownAutoComplete>
        <OptionSelector
          title={t('Display')}
          selected={displayMode}
          options={displayOptions}
          onChange={onDisplayChange}
        />
        {TOP_EVENT_MODES.includes(displayMode) && (
          <OptionSelector
            title={t('Limit')}
            selected={topEvents}
            options={topEventOptions}
            onChange={onTopEventsChange}
          />
        )}
        {TOP_EVENT_MODES.includes(displayMode) ? (
          <OptionSelector
            title={t('Y-Axis')}
            selected={yAxisValue[0]}
            options={yAxisOptions}
            onChange={yAxis => onAxisChange([yAxis])}
          />
        ) : (
          <OptionSelector
            multiple
            isClearable
            menuTitle={
              yAxisOptions.length > 3 ? t('Select up to 3 options') : t('Y-axis')
            }
            title={t('Y-Axis')}
            selected={yAxisValue}
            options={yAxisOptions}
            onChange={onAxisChange}
          />
        )}
      </InlineContainer>
    </ChartControls>
  );
}

const SwitchLabel = styled('div')`
  padding-right: 4px;
  font-weight: bold;
`;
