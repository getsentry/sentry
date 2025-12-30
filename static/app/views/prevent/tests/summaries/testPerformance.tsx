import {Fragment} from 'react';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {SummaryCard, SummaryCardGroup} from 'sentry/components/prevent/summary';
import {t} from 'sentry/locale';
import {formatPercentRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

function FlakyTestsTooltip() {
  return (
    <Flex direction="column" gap="sm">
      {props => (
        <Text {...props} align="left">
          <Heading as="h5">{t('What is it:')}</Heading>
          <Text>
            {t('The number of tests that transition from fail to pass or pass to fail.')}
          </Text>
        </Text>
      )}
    </Flex>
  );
}

function AverageFlakeTooltip() {
  return (
    <Flex direction="column" gap="sm">
      {props => (
        <Text {...props} align="left">
          <Heading as="h5">{t('Impact:')}</Heading>
          <Text>{t('The average flake rate on your selected branch.')}</Text>
          <Heading as="h5">{t('What is it:')}</Heading>
          <Text>
            {t(
              'The percentage of tests that flake, based on how many times a test transitions from fail to pass or pass to fail on a given branch and commit.'
            )}
          </Text>
        </Text>
      )}
    </Flex>
  );
}

function CumulativeFailuresTooltip() {
  return (
    <Flex direction="column" gap="sm">
      {props => (
        <Text {...props} align="left">
          <Heading as="h5">{t('Impact:')}</Heading>
          <Text>{t('The number of test failures on your default branch.')}</Text>
          <Heading as="h5">{t('What is it:')}</Heading>
          <Text>{t('The number of individual runs of tests that failed.')}</Text>
        </Text>
      )}
    </Flex>
  );
}

function SkippedTestsTooltip() {
  return (
    <Flex direction="column" gap="sm">
      {props => (
        <Text {...props} align="left">
          <Heading as="h5">{t('What is it:')}</Heading>
          <Text>{t('The number of individual runs of tests that were skipped.')}</Text>
        </Text>
      )}
    </Flex>
  );
}

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
    <Fragment>
      <SummaryCard
        label={t('Flaky Tests')}
        tooltip={<FlakyTestsTooltip />}
        value={flakyTests?.toLocaleString()}
        filterBy="flakyTests"
        extra={
          flakyTestsChange ? (
            <Tag variant={flakyTestsChange > 0 ? 'danger' : 'success'}>
              {formatPercentRate(flakyTestsChange, {minimumValue: 0.01})}
            </Tag>
          ) : undefined
        }
      />
      <SummaryCard
        label={t('Avg. Flake Rate')}
        tooltip={<AverageFlakeTooltip />}
        value={
          averageFlakeRate === undefined
            ? undefined
            : formatPercentage(averageFlakeRate / 100, 2, {minimumValue: 0.0001})
        }
        extra={
          averageFlakeRateChange ? (
            <Tag variant={averageFlakeRateChange > 0 ? 'danger' : 'success'}>
              {formatPercentRate(averageFlakeRateChange, {minimumValue: 0.01})}
            </Tag>
          ) : undefined
        }
      />
      <SummaryCard
        label={t('Cumulative Failures')}
        tooltip={<CumulativeFailuresTooltip />}
        value={cumulativeFailures?.toLocaleString()}
        filterBy="failedTests"
        extra={
          cumulativeFailuresChange ? (
            <Tag variant={cumulativeFailuresChange > 0 ? 'danger' : 'success'}>
              {formatPercentRate(cumulativeFailuresChange, {minimumValue: 0.01})}
            </Tag>
          ) : undefined
        }
      />
      <SummaryCard
        label={t('Skipped Tests')}
        tooltip={<SkippedTestsTooltip />}
        value={skippedTests?.toLocaleString()}
        filterBy="skippedTests"
        extra={
          skippedTestsChange ? (
            <Tag variant={skippedTestsChange > 0 ? 'danger' : 'success'}>
              {formatPercentRate(skippedTestsChange, {minimumValue: 0.01})}
            </Tag>
          ) : undefined
        }
      />
    </Fragment>
  );
}

interface TestPerformanceProps extends TestPerformanceBodyProps {
  isLoading: boolean;
}

export function TestPerformance({isLoading, ...bodyProps}: TestPerformanceProps) {
  return (
    <SummaryCardGroup
      title={t('Test Performance')}
      isLoading={isLoading}
      placeholderCount={4}
    >
      <TestPerformanceBody {...bodyProps} />
    </SummaryCardGroup>
  );
}
