import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import IntervalSelector from 'sentry/components/charts/intervalSelector';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import FeatureBadge from 'sentry/components/featureBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Switch from 'sentry/components/switchButton';
import {t, tct} from 'sentry/locale';
import {Organization, SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {TOP_EVENT_MODES} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import localStorage from 'sentry/utils/localStorage';

export const PROCESSED_BASELINE_TOGGLE_KEY = 'show-processed-baseline';

type Props = {
  displayMode: string;
  displayOptions: SelectValue<string>[];
  eventView: EventView;
  onAxisChange: (value: string[]) => void;
  onDisplayChange: (value: string) => void;
  onIntervalChange: (value: string | undefined) => void;
  onTopEventsChange: (value: string) => void;
  organization: Organization;
  setShowBaseline: (value: boolean) => void;
  showBaseline: boolean;
  topEvents: string;
  total: number | null;
  yAxisOptions: SelectValue<string>[];
  yAxisValue: string[];
  disableProcessedBaselineToggle?: boolean;
  loadingProcessedTotals?: boolean;
  processedTotal?: number;
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
  disableProcessedBaselineToggle,
  eventView,
  processedTotal,
  loadingProcessedTotals,
}: Props) {
  const elements: React.ReactNode[] = [];

  elements.push(<SectionHeading key="total-label">{t('Total Events')}</SectionHeading>);
  elements.push(
    total === null || loadingProcessedTotals === true ? (
      <SectionValue data-test-id="loading-placeholder" key="total-value">
        &mdash;
      </SectionValue>
    ) : defined(processedTotal) ? (
      <SectionValue key="total-value">
        {tct('[indexedTotal] of [processedTotal]', {
          indexedTotal: formatAbbreviatedNumber(total),
          processedTotal: formatAbbreviatedNumber(processedTotal),
        })}
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
        <Feature organization={organization} features={['discover-metrics-baseline']}>
          <Fragment>
            <SwitchLabel>{t('Processed events')}</SwitchLabel>
            <Switch
              data-test-id="processed-events-toggle"
              isActive={showBaseline}
              isDisabled={disableProcessedBaselineToggle ?? true}
              size="lg"
              toggle={() => {
                const value = !showBaseline;
                localStorage.setItem(
                  PROCESSED_BASELINE_TOGGLE_KEY,
                  value === true ? '1' : '0'
                );
                trackAdvancedAnalyticsEvent(
                  'discover_v2.processed_baseline_toggle.clicked',
                  {
                    organization,
                    toggled: value === true ? 'on' : 'off',
                  }
                );
                setShowBaseline(value);
              }}
            />
            <QuestionTooltip
              isHoverable
              position="top"
              size="sm"
              title={tct(
                'Show a baseline of client-side [processedEventsLink: processed events].[break]Available on the Total Period display for y-axes scoped to [transactionEventsLink: transaction events].',
                {
                  transactionEventsLink: (
                    <ExternalLink href="https://docs.sentry.io/product/sentry-basics/tracing/event-detail/" />
                  ),
                  processedEventsLink: (
                    <ExternalLink href="https://docs.sentry.io/product/data-management-settings/server-side-sampling/" />
                  ),
                  break: (
                    <div>
                      <br />
                    </div>
                  ),
                }
              )}
            />
            <FeatureBadge type="beta" />
          </Fragment>
        </Feature>
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
