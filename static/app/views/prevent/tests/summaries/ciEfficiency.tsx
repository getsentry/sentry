import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {
  SummaryEntries,
  SummaryEntry,
  SummaryEntryValue,
  SummaryEntryValueLink,
} from 'sentry/components/prevent/summary';
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
    <SummaryEntries largeColumnSpan={9} smallColumnSpan={1}>
      <SummaryEntry columns={5}>
        <Tooltip showUnderline title={<TotalTestsRunTimeTooltip />}>
          {t('Total Tests Run Time')}
        </Tooltip>
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
      <SummaryEntry columns={4}>
        <Tooltip
          showUnderline
          title={
            <SlowestTestsTooltip
              slowestTests={slowestTests}
              slowestTestsDuration={slowestTestsDuration}
            />
          }
        >
          {t('Slowest Tests (P95)')}
        </Tooltip>
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
    grid-column: span 9;
  }
`;
