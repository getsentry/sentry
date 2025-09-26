import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {
  SummaryEntries,
  SummaryEntry,
  SummaryEntryValue,
  SummaryEntryValueLink,
} from 'sentry/components/prevent/summary';
import {t} from 'sentry/locale';
import {formatPercentRate} from 'sentry/utils/formatters';

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
    <SummaryEntries largeColumnSpan={15} smallColumnSpan={1}>
      <SummaryEntry columns={4}>
        <Tooltip showUnderline title={<FlakyTestsTooltip />}>
          {t('Flaky Tests')}
        </Tooltip>
        {flakyTests === undefined ? (
          <SummaryEntryValue>-</SummaryEntryValue>
        ) : (
          <SummaryEntryValue>
            <SummaryEntryValueLink filterBy="flakyTests">
              {flakyTests}
            </SummaryEntryValueLink>
            {typeof flakyTestsChange === 'number' && flakyTestsChange !== 0 && (
              <Tag type={flakyTestsChange > 0 ? 'error' : 'success'}>
                {formatPercentRate(flakyTestsChange)}
              </Tag>
            )}
          </SummaryEntryValue>
        )}
      </SummaryEntry>
      <SummaryEntry columns={4}>
        <Tooltip showUnderline title={<AverageFlakeTooltip />}>
          {t('Avg. Flake Rate')}
        </Tooltip>
        <SummaryEntryValue>
          {averageFlakeRate === undefined ? '-' : `${averageFlakeRate?.toFixed(2)}%`}
          {typeof averageFlakeRateChange === 'number' && averageFlakeRateChange !== 0 && (
            <Tag type={averageFlakeRateChange > 0 ? 'error' : 'success'}>
              {formatPercentRate(averageFlakeRateChange)}
            </Tag>
          )}
        </SummaryEntryValue>
      </SummaryEntry>
      <SummaryEntry columns={4}>
        <Tooltip showUnderline title={<CumulativeFailuresTooltip />}>
          {t('Cumulative Failures')}
        </Tooltip>
        {cumulativeFailures === undefined ? (
          <SummaryEntryValue>-</SummaryEntryValue>
        ) : (
          <SummaryEntryValue>
            <SummaryEntryValueLink filterBy="failedTests">
              {cumulativeFailures}
            </SummaryEntryValueLink>
            {typeof cumulativeFailuresChange === 'number' &&
              cumulativeFailuresChange !== 0 && (
                <Tag type={cumulativeFailuresChange > 0 ? 'error' : 'success'}>
                  {formatPercentRate(cumulativeFailuresChange)}
                </Tag>
              )}
          </SummaryEntryValue>
        )}
      </SummaryEntry>
      <SummaryEntry columns={3}>
        <Tooltip showUnderline title={<SkippedTestsTooltip />}>
          {t('Skipped Tests')}
        </Tooltip>
        {skippedTests === undefined ? (
          <SummaryEntryValue>-</SummaryEntryValue>
        ) : (
          <SummaryEntryValue>
            <SummaryEntryValueLink filterBy="skippedTests">
              {skippedTests}
            </SummaryEntryValueLink>
            {typeof skippedTestsChange === 'number' && skippedTestsChange !== 0 && (
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
    grid-column: span 15;
  }
`;
