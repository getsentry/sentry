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
        The cumulative CI time spent running tests over the last 30 days.
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
        The slowest 100 tests take {formatTimeDuration(slowestTestsDuration)} to run.
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

interface CIEfficiencyProps {
  slowestTests: number;
  slowestTestsDuration: number;
  totalTestsRunTime: number;
  totalTestsRunTimeChange: number;
}

export function CIEfficiency({
  slowestTests,
  slowestTestsDuration,
  totalTestsRunTime,
  totalTestsRunTimeChange,
}: CIEfficiencyProps) {
  return (
    <CIEfficiencyPanel>
      <PanelHeader>{t('CI Efficiency')}</PanelHeader>
      <PanelBody>
        <SummaryEntries largeColumnSpan={2} smallColumnSpan={1}>
          <SummaryEntry>
            <SummaryEntryLabel showUnderline body={<TotalTestsRunTimeTooltip />}>
              {t('Total Tests Run Time')}
            </SummaryEntryLabel>
            <div>
              <SummaryEntryValue>
                {formatTimeDuration(totalTestsRunTime)}
                <Tag type={totalTestsRunTimeChange > 0 ? 'error' : 'success'}>
                  {formatPercentRate(totalTestsRunTimeChange)}
                </Tag>
              </SummaryEntryValue>
            </div>
          </SummaryEntry>
          <SummaryEntry>
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
      </PanelBody>
    </CIEfficiencyPanel>
  );
}

const CIEfficiencyPanel = styled(Panel)`
  grid-column: span 24;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-column: span 9;
  }
`;
