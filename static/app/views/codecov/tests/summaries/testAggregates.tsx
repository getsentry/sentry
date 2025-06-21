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

function FlakyTestsTooltip() {
  return (
    <Fragment>
      <p>
        <ToolTipTitle>What is it:</ToolTipTitle>
        The number of tests that transition from fail to pass or pass to fail.
      </p>
    </Fragment>
  );
}

function AverageFlakeTooltip() {
  return (
    <Fragment>
      <p>
        <ToolTipTitle>Impact:</ToolTipTitle>
        The average flake rate on your default branch.
      </p>
      <p>
        <ToolTipTitle>What is it:</ToolTipTitle>
        The percentage of tests that flake, based on how many times a test transitions
        from fail to pass or pass to fail on a given branch and commit.
      </p>
    </Fragment>
  );
}

function CumulativeFailuresTooltip() {
  return (
    <Fragment>
      <p>
        <ToolTipTitle>Impact:</ToolTipTitle>
        The number of test failures on your default branch.
      </p>
      <p>
        <ToolTipTitle>What is it:</ToolTipTitle>
        The sum of all test failures, incremented each time any test has failed.
      </p>
    </Fragment>
  );
}

function SkippedTestsTooltip() {
  return (
    <Fragment>
      <p>
        <ToolTipTitle>What is it:</ToolTipTitle>
        The number of tests that were skipped.
      </p>
    </Fragment>
  );
}

const ToolTipTitle = styled('strong')`
  display: block;
`;

interface TestAggregatesBodyProps {
  averageFlakeRate?: number;
  averageFlakeRateChange?: number | null;
  cumulativeFailures?: number;
  cumulativeFailuresChange?: number | null;
  flakyTests?: number;
  flakyTestsChange?: number | null;
  skippedTests?: number;
  skippedTestsChange?: number | null;
  totalTestsRunTime?: number;
  totalTestsRunTimeChange?: number | null;
}

function TestAggregatesBody({
  totalTestsRunTime,
  totalTestsRunTimeChange,
  averageFlakeRate,
  averageFlakeRateChange,
  cumulativeFailures,
  cumulativeFailuresChange,
  flakyTests,
  flakyTestsChange,
  skippedTests,
  skippedTestsChange,
}: TestAggregatesBodyProps) {
  return (
    <SummaryEntries largeColumnSpan={5} smallColumnSpan={1}>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<TotalTestsRunTimeTooltip />}>
          {t('Total Tests Run Time')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          {formatTimeDuration(totalTestsRunTime, 2)}
          {totalTestsRunTimeChange ? (
            <Tag type={totalTestsRunTimeChange > 0 ? 'error' : 'success'}>
              {formatPercentRate(totalTestsRunTimeChange)}
            </Tag>
          ) : null}
        </SummaryEntryValue>
      </SummaryEntry>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<FlakyTestsTooltip />}>
          {t('Flaky Tests')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          <SummaryEntryValueLink filterBy="flakyTests">
            {flakyTests}
          </SummaryEntryValueLink>
          {flakyTestsChange ? (
            <Tag type={flakyTestsChange > 0 ? 'error' : 'success'}>
              {formatPercentRate(flakyTestsChange)}
            </Tag>
          ) : null}
        </SummaryEntryValue>
      </SummaryEntry>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<AverageFlakeTooltip />}>
          {t('Avg. Flake Rate')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          {`${averageFlakeRate?.toFixed(2)}%`}
          {averageFlakeRateChange ? (
            <Tag type={averageFlakeRateChange > 0 ? 'error' : 'success'}>
              {formatPercentRate(averageFlakeRateChange)}
            </Tag>
          ) : null}
        </SummaryEntryValue>
      </SummaryEntry>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<CumulativeFailuresTooltip />}>
          {t('Cumulative Failures')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          <SummaryEntryValueLink filterBy="failedTests">
            {cumulativeFailures}
          </SummaryEntryValueLink>
          {cumulativeFailuresChange ? (
            <Tag type={cumulativeFailuresChange > 0 ? 'error' : 'success'}>
              {formatPercentRate(cumulativeFailuresChange)}
            </Tag>
          ) : null}
        </SummaryEntryValue>
      </SummaryEntry>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<SkippedTestsTooltip />}>
          {t('Skipped Tests')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          <SummaryEntryValueLink filterBy="skippedTests">
            {skippedTests}
          </SummaryEntryValueLink>
          {skippedTestsChange ? (
            <Tag type={skippedTestsChange > 0 ? 'error' : 'success'}>
              {formatPercentRate(skippedTestsChange)}
            </Tag>
          ) : null}
        </SummaryEntryValue>
      </SummaryEntry>
    </SummaryEntries>
  );
}

interface TestAggregatesProps extends TestAggregatesBodyProps {
  isLoading: boolean;
}

export function TestAggregates({isLoading, ...bodyProps}: TestAggregatesProps) {
  return (
    <TestAggregatesPanel>
      <PanelHeader>{t('Test Aggregates')}</PanelHeader>
      <PanelBody>
        {isLoading ? <LoadingIndicator /> : <TestAggregatesBody {...bodyProps} />}
      </PanelBody>
    </TestAggregatesPanel>
  );
}

const TestAggregatesPanel = styled(Panel)`
  grid-column: span 24;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-column: span 24;
  }
`;
