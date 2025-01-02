import IntervalSelector from 'sentry/components/charts/intervalSelector';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type EventView from 'sentry/utils/discover/eventView';
import {TOP_EVENT_MODES} from 'sentry/utils/discover/types';

export const PROCESSED_BASELINE_TOGGLE_KEY = 'show-processed-baseline';

type Props = {
  displayMode: string;
  displayOptions: SelectValue<string>[];
  eventView: EventView;
  onAxisChange: (value: string[]) => void;
  onDisplayChange: (value: string) => void;
  onIntervalChange: (value: string | undefined) => void;
  onTopEventsChange: (value: string) => void;
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
  eventView,
}: Props) {
  const elements: React.ReactNode[] = [];

  elements.push(<SectionHeading key="total-label">{t('Sample Count')}</SectionHeading>);
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

  return (
    <ChartControls>
      <InlineContainer>{elements}</InlineContainer>
      <InlineContainer>
        <IntervalSelector
          displayMode={displayMode}
          eventView={eventView}
          onIntervalChange={onIntervalChange}
        />
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
            selected={yAxisValue[0]!}
            options={yAxisOptions}
            onChange={yAxis => onAxisChange([yAxis])}
          />
        ) : (
          <OptionSelector
            multiple
            clearable
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
