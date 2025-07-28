import {Fragment} from 'react';
import styled from '@emotion/styled';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {
  SummaryEntries,
  SummaryEntry,
  SummaryEntryLabel,
  SummaryEntryValue,
  SummaryEntryValueLink,
} from 'sentry/components/codecov/summary';
import {Tag} from 'sentry/components/core/badge/tag';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {formatPercentRate, formatTimeDuration} from 'sentry/utils/formatters';

function TotalTestsRunTimeTooltip() {
  const {codecovPeriod} = useCodecovContext();

  return (
    <Fragment>
      <p>
        <ToolTipTitle>Impact:</ToolTipTitle>
        {/* TODO: this is a dynamic value based on the selector */}
        The cumulative CI time spent running tests over the last{' '}
        <strong>{codecovPeriod}</strong>.
      </p>
      <p>
        <ToolTipTitle>What is it:</ToolTipTitle>
        The total time it takes to run all your tests.
      </p>
    </Fragment>
  );
}

interface SlowestTestsTooltipProps {
  slowestTests?: number;
  slowestTestsDuration?: number;
}

function SlowestTestsTooltip({
  slowestTests,
  slowestTestsDuration,
}: SlowestTestsTooltipProps) {
  return (
    <Fragment>
      {/* TODO: add t/tct for these tooltips */}
      <p>
        <ToolTipTitle>Impact:</ToolTipTitle>
        The slowest <strong>{slowestTests}</strong> tests take{' '}
        <strong>{formatTimeDuration(slowestTestsDuration, 2)}</strong> to run.
      </p>
      <p>
        <ToolTipTitle>What is it:</ToolTipTitle>
        Lists the tests that take more than the 95th percentile run time to complete.
        Showing a max of 100 tests.
      </p>
    </Fragment>
  );
}

const ToolTipTitle = styled('strong')`
  display: block;
`;

interface CIEfficiencyBodyProps {
  slowestTests?: number;
  slowestTestsDuration?: number;
  totalTestsRunTime?: number;
  totalTestsRunTimeChange?: number | null;
}

function CIEfficiencyBody({
  totalTestsRunTime,
  totalTestsRunTimeChange,
  slowestTests,
  slowestTestsDuration,
}: CIEfficiencyBodyProps) {
  return (
    <SummaryEntries largeColumnSpan={8} smallColumnSpan={1}>
      <SummaryEntry columns={5}>
        <SummaryEntryLabel showUnderline body={<TotalTestsRunTimeTooltip />}>
          {t('Total Tests Run Time')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          {totalTestsRunTime === undefined
            ? '-'
            : formatTimeDuration(totalTestsRunTime, 2)}
          {typeof totalTestsRunTimeChange === 'number' &&
            totalTestsRunTimeChange !== 0 && (
              <Tag type={totalTestsRunTimeChange > 0 ? 'error' : 'success'}>
                {formatPercentRate(totalTestsRunTimeChange)}
              </Tag>
            )}
        </SummaryEntryValue>
      </SummaryEntry>
      <SummaryEntry columns={3}>
        <SummaryEntryLabel
          showUnderline
          body={
            <SlowestTestsTooltip
              slowestTests={slowestTests}
              slowestTestsDuration={slowestTestsDuration}
            />
          }
        >
          {t('Slowest Tests (P95)')}
        </SummaryEntryLabel>
        {slowestTestsDuration === undefined ? (
          <SummaryEntryValue>-</SummaryEntryValue>
        ) : (
          <SummaryEntryValueLink filterBy="slowestTests">
            {formatTimeDuration(slowestTestsDuration, 2)}
          </SummaryEntryValueLink>
        )}
      </SummaryEntry>
    </SummaryEntries>
  );
}

interface CIEfficiencyProps extends CIEfficiencyBodyProps {
  isLoading: boolean;
}

export function CIEfficiency({isLoading, ...bodyProps}: CIEfficiencyProps) {
  return (
    <CIEfficiencyPanel>
      <PanelHeader>{t('CI Run Efficiency')}</PanelHeader>
      <PanelBody>
        {isLoading ? <LoadingIndicator /> : <CIEfficiencyBody {...bodyProps} />}
      </PanelBody>
    </CIEfficiencyPanel>
  );
}

const CIEfficiencyPanel = styled(Panel)`
  grid-column: span 24;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-column: span 8;
  }
`;
