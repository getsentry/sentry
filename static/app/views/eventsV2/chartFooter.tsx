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
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Switch from 'sentry/components/switchButton';
import {t, tct} from 'sentry/locale';
import {Organization, SelectValue} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {TOP_EVENT_MODES} from 'sentry/utils/discover/types';

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
  disableProcessedBaselineToggle?: boolean;
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
}: Props) {
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
              toggle={() => setShowBaseline(!showBaseline)}
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
          </Fragment>
        </Feature>
        <Feature organization={organization} features={['discover-interval-selector']}>
          <IntervalSelector eventView={eventView} onIntervalChange={onIntervalChange} />
        </Feature>
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
