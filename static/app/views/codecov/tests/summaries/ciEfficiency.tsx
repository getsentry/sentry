import {Fragment} from 'react';
import styled from '@emotion/styled';

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
  return (
    <Fragment>
      <p>
        <ToolTipTitle>Impact:</ToolTipTitle>
        {/* TODO: this is a dynamic value based on the selector */}
        The cumulative CI time spent running tests over the last <strong>30 days</strong>.
      </p>
      <p>
        <ToolTipTitle>What is it:</ToolTipTitle>
        The total time it takes to run all your tests.
      </p>
    </Fragment>
  );
}

interface SlowestTestsTooltipProps {
  slowestTestsDuration: number;
}

function SlowestTestsTooltip({slowestTestsDuration}: SlowestTestsTooltipProps) {
  return (
    <Fragment>
      <p>
        <ToolTipTitle>Impact:</ToolTipTitle>
        The slowest 100 tests take{' '}
        <strong>{formatTimeDuration(slowestTestsDuration)}</strong> to run.
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
  slowestTests: number;
  slowestTestsDuration: number;
  totalTestsRunTime: number;
  totalTestsRunTimeChange: number;
}

function CIEfficiencyBody({
  totalTestsRunTime,
  totalTestsRunTimeChange,
  slowestTestsDuration,
  slowestTests,
}: CIEfficiencyBodyProps) {
  return (
    <SummaryEntries largeColumnSpan={8} smallColumnSpan={1}>
      <SummaryEntry columns={5}>
        <SummaryEntryLabel showUnderline body={<TotalTestsRunTimeTooltip />}>
          {t('Total Tests Run Time')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          {formatTimeDuration(totalTestsRunTime)}
          <Tag type={totalTestsRunTimeChange > 0 ? 'error' : 'success'}>
            {formatPercentRate(totalTestsRunTimeChange)}
          </Tag>
        </SummaryEntryValue>
      </SummaryEntry>
      <SummaryEntry columns={3}>
        <SummaryEntryLabel
          showUnderline
          body={<SlowestTestsTooltip slowestTestsDuration={slowestTestsDuration} />}
        >
          {t('Slowest Tests')}
        </SummaryEntryLabel>
        <SummaryEntryValueLink filterBy="slowest_tests">
          {slowestTests}
        </SummaryEntryValueLink>
      </SummaryEntry>
    </SummaryEntries>
  );
}

interface CIEfficiencyProps {
  isLoading: boolean;
  slowestTests: number;
  slowestTestsDuration: number;
  totalTestsRunTime: number;
  totalTestsRunTimeChange: number;
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

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-column: span 8;
  }
`;
