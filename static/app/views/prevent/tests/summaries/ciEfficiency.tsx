import {Fragment} from 'react';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {SummaryCard, SummaryCardGroup} from 'sentry/components/prevent/summary';
import {t, tct} from 'sentry/locale';
import {formatPercentRate, formatTimeDuration} from 'sentry/utils/formatters';

function TotalTestsRunTimeTooltip() {
  const {preventPeriod} = usePreventContext();

  return (
    <Flex direction="column" gap="sm">
      {props => (
        <Text {...props} align="left">
          <Heading as="h5">{t('Impact:')}</Heading>
          <Text>
            {tct('The cumulative CI time spent running tests over the last [period].', {
              period: <strong>{preventPeriod}</strong>,
            })}
          </Text>
          <Heading as="h5">{t('What is it:')}</Heading>
          <Text>{t('The total time it takes to run all your tests.')}</Text>
        </Text>
      )}
    </Flex>
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
    <Flex direction="column" gap="sm">
      {props => (
        <Text {...props} align="left">
          <Heading as="h5">{t('Impact:')}</Heading>
          <Text>
            {tct('The slowest [count] tests take [duration] to run.', {
              count: <strong>{slowestTests}</strong>,
              duration: <strong>{formatTimeDuration(slowestTestsDuration, 2)}</strong>,
            })}
          </Text>
          <Heading as="h5">{t('What is it:')}</Heading>
          <Text>
            {t(
              'Lists the tests that take more than the 95th percentile run time to complete. Showing a max of 100 tests.'
            )}
          </Text>
        </Text>
      )}
    </Flex>
  );
}

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
    <Fragment>
      <SummaryCard
        label={t('Total Tests Run Time')}
        tooltip={<TotalTestsRunTimeTooltip />}
        value={
          totalTestsRunTime === undefined
            ? undefined
            : formatTimeDuration(totalTestsRunTime, 2)
        }
        extra={
          totalTestsRunTimeChange ? (
            <Tag variant={totalTestsRunTimeChange > 0 ? 'danger' : 'success'}>
              {formatPercentRate(totalTestsRunTimeChange, {minimumValue: 0.01})}
            </Tag>
          ) : undefined
        }
      />
      <SummaryCard
        label={t('Slowest Tests (P95)')}
        tooltip={
          <SlowestTestsTooltip
            slowestTests={slowestTests}
            slowestTestsDuration={slowestTestsDuration}
          />
        }
        value={
          slowestTestsDuration === undefined
            ? undefined
            : formatTimeDuration(slowestTestsDuration, 2)
        }
        filterBy="slowestTests"
      />
    </Fragment>
  );
}

interface CIEfficiencyProps extends CIEfficiencyBodyProps {
  isLoading: boolean;
}

export function CIEfficiency({isLoading, ...bodyProps}: CIEfficiencyProps) {
  return (
    <SummaryCardGroup
      title={t('CI Run Efficiency')}
      isLoading={isLoading}
      placeholderCount={2}
    >
      <CIEfficiencyBody {...bodyProps} />
    </SummaryCardGroup>
  );
}
