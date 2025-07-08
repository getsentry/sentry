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

interface TestPerformanceBodyProps {
  averageFlakeRate?: number;
  averageFlakeRateChange?: number | null;
  cumulativeFailures?: number;
  cumulativeFailuresChange?: number | null;
  flakyTests?: number;
  flakyTestsChange?: number | null;
  skippedTests?: number;
  skippedTestsChange?: number | null;
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
        {flakyTests ? (
          <SummaryEntryValue>
            <SummaryEntryValueLink filterBy="flakyTests">
              {flakyTests}
            </SummaryEntryValueLink>
            {flakyTestsChange && (
              <Tag type={flakyTestsChange > 0 ? 'error' : 'success'}>
                {formatPercentRate(flakyTestsChange)}
              </Tag>
            )}
          </SummaryEntryValue>
        ) : (
          <SummaryEntryValue>-</SummaryEntryValue>
        )}
      </SummaryEntry>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<AverageFlakeTooltip />}>
          {t('Avg. Flake Rate')}
        </SummaryEntryLabel>
        <SummaryEntryValue>
          {averageFlakeRate === undefined ? '-' : `${averageFlakeRate?.toFixed(2)}%`}
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
        {cumulativeFailures ? (
          <SummaryEntryValue>
            <SummaryEntryValueLink filterBy="failedTests">
              {cumulativeFailures}
            </SummaryEntryValueLink>
            {cumulativeFailuresChange && (
              <Tag type={cumulativeFailuresChange > 0 ? 'error' : 'success'}>
                {formatPercentRate(cumulativeFailuresChange)}
              </Tag>
            )}
          </SummaryEntryValue>
        ) : (
          <SummaryEntryValue>-</SummaryEntryValue>
        )}
      </SummaryEntry>
      <SummaryEntry>
        <SummaryEntryLabel showUnderline body={<SkippedTestsTooltip />}>
          {t('Skipped Tests')}
        </SummaryEntryLabel>
        {skippedTests === undefined ? (
          <SummaryEntryValue>-</SummaryEntryValue>
        ) : (
          <SummaryEntryValue>
            <SummaryEntryValueLink filterBy="skippedTests">
              {skippedTests}
            </SummaryEntryValueLink>
            {skippedTestsChange && (
              <Tag type={skippedTestsChange > 0 ? 'error' : 'success'}>
                {formatPercentRate(skippedTestsChange)}
              </Tag>
            )}
          </SummaryEntryValue>
        )}
      </SummaryEntry>
    </SummaryEntries>
  );
}

interface TestPerformanceProps extends TestPerformanceBodyProps {
  isLoading: boolean;
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

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-column: span 16;
  }
`;
