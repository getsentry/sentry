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
import {formatPercentRate} from 'sentry/utils/formatters';

function FlakyTestsTooltip() {
  return (
    <Fragment>
      <p>
        <ToolTipTitle>Impact:</ToolTipTitle>
        The number of flaky tests in your test suite.
      </p>
      <p>
        <ToolTipTitle>What is it:</ToolTipTitle>
        The total time it takes to run all your tests.
      </p>
    </Fragment>
  );
}

function AverageFlakeTooltip() {
  return (
    <Fragment>
      <p>
        <ToolTipTitle>Impact:</ToolTipTitle>
        The average flake rate on your <strong>main branch</strong>.
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
        The number of test failures on your main branch.
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
        <ToolTipTitle>Impact:</ToolTipTitle>
        The number of skipped tests in your test suite.
      </p>
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

interface TestPerformanceBodyProps {
  averageFlakeRate: number;
  averageFlakeRateChange: number;
  cumulativeFailures: number;
  cumulativeFailuresChange: number;
  flakyTests: number;
  flakyTestsChange: number;
  skippedTests: number;
  skippedTestsChange: number;
}

function TestPerformanceBody({
  averageFlakeRate,
  averageFlakeRateChange,
  cumulativeFailures,
  cumulativeFailuresChange,
  flakyTests,
  flakyTestsChange,
  skippedTests,
  skippedTestsChange,
}: TestPerformanceBodyProps) {
  return (
    <SummaryEntries largeColumnSpan={4} smallColumnSpan={1}>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<FlakyTestsTooltip />}>
          {t('Flaky Tests')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          <SummaryEntryValueLink filterBy="flaky_tests">
            {flakyTests}
          </SummaryEntryValueLink>
          <Tag type={flakyTestsChange > 0 ? 'error' : 'success'}>
            {formatPercentRate(flakyTestsChange)}
          </Tag>
        </SummaryEntryValue>
      </SummaryEntry>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<AverageFlakeTooltip />}>
          {t('Avg. Flake Rate')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          {`${averageFlakeRate}%`}
          <Tag type={averageFlakeRateChange > 0 ? 'error' : 'success'}>
            {formatPercentRate(averageFlakeRateChange)}
          </Tag>
        </SummaryEntryValue>
      </SummaryEntry>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<CumulativeFailuresTooltip />}>
          {t('Cumulative Failures')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          <SummaryEntryValueLink filterBy="cumulative_failures">
            {cumulativeFailures}
          </SummaryEntryValueLink>
          <Tag type={cumulativeFailuresChange > 0 ? 'error' : 'success'}>
            {formatPercentRate(cumulativeFailuresChange)}
          </Tag>
        </SummaryEntryValue>
      </SummaryEntry>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<SkippedTestsTooltip />}>
          {t('Skipped Tests')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          <SummaryEntryValueLink filterBy="skipped_tests">
            {skippedTests}
          </SummaryEntryValueLink>
          <Tag type={skippedTestsChange > 0 ? 'error' : 'success'}>
            {formatPercentRate(skippedTestsChange)}
          </Tag>
        </SummaryEntryValue>
      </SummaryEntry>
    </SummaryEntries>
  );
}

interface TestPerformanceProps {
  averageFlakeRate: number;
  averageFlakeRateChange: number;
  cumulativeFailures: number;
  cumulativeFailuresChange: number;
  flakyTests: number;
  flakyTestsChange: number;
  isLoading: boolean;
  skippedTests: number;
  skippedTestsChange: number;
}

export function TestPerformance({isLoading, ...bodyProps}: TestPerformanceProps) {
  return (
    <TestPerformancePanel>
      <PanelHeader>{t('Test Performance')}</PanelHeader>
      <PanelBody>
        {isLoading ? <LoadingIndicator /> : <TestPerformanceBody {...bodyProps} />}
      </PanelBody>
    </TestPerformancePanel>
  );
}

const TestPerformancePanel = styled(Panel)`
  grid-column: span 24;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-column: span 16;
  }
`;
