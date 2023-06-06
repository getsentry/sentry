import {CSSProperties, Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import PerformanceDuration from 'sentry/components/performanceDuration';
import ScoreBar from 'sentry/components/scoreBar';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconChevron, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {EventsResultsDataRow} from 'sentry/utils/profiling/hooks/types';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

const MAX_FUNCTIONS = 3;

export function SlowestFunctionsWidget() {
  const [expandedIndex, setExpandedIndex] = useState(0);

  const query = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('is_application', ['1']);
    return conditions.formatString();
  }, []);

  const functionsQuery = useProfileFunctions<FunctionsField>({
    fields: functionsFields,
    referrer: 'api.profiling.suspect-functions.list',
    sort: {
      key: 'sum()',
      order: 'desc',
    },
    query,
    limit: MAX_FUNCTIONS,
  });

  const totalsQuery = useProfileFunctions<TotalsField>({
    fields: totalsFields,
    referrer: 'api.profiling.suspect-functions.totals',
    sort: {
      key: 'sum()',
      order: 'desc',
    },
    query,
    limit: MAX_FUNCTIONS,
    // make sure to query for the projects from the top functions
    projects: functionsQuery.isFetched
      ? [
          ...new Set(
            (functionsQuery.data?.data ?? []).map(func => func['project.id'] as number)
          ),
        ]
      : [],
    enabled: functionsQuery.isFetched && defined(functionsQuery.data?.data),
  });

  return (
    <Container>
      <HeaderContainer>
        <StyledHeaderTitleLegend>{t('Suspect Functions')}</StyledHeaderTitleLegend>
        <Subtitle>{t('Slowest functions by total time spent.')}</Subtitle>
      </HeaderContainer>
      <ContentContainer>
        {(functionsQuery.isError || totalsQuery.isError) && (
          <StatusContainer height="100%">
            <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
          </StatusContainer>
        )}
        {(functionsQuery.isLoading || totalsQuery.isLoading) && (
          <StatusContainer height="100%">
            <LoadingIndicator />
          </StatusContainer>
        )}
        {functionsQuery.isFetched && totalsQuery.isFetched && (
          <Accordion>
            {(functionsQuery.data?.data ?? []).map((f, i) => {
              const projectEntry = totalsQuery.data?.data?.find(
                row => row['project.id'] === f['project.id']
              );
              const projectTotalDuration = projectEntry?.['sum()'] ?? f['sum()'];
              return (
                <SlowestFunctionEntry
                  key={`${f.package}-${f.function}`}
                  isExpanded={i === expandedIndex}
                  setExpanded={() => setExpandedIndex(i)}
                  func={f}
                  totalDuration={projectTotalDuration as number}
                />
              );
            })}
          </Accordion>
        )}
      </ContentContainer>
    </Container>
  );
}

interface SlowestFunctionEntryProps {
  func: EventsResultsDataRow<FunctionsField>;
  isExpanded: boolean;
  setExpanded: () => void;
  totalDuration: number;
}

const BARS = 10;

function SlowestFunctionEntry({
  func,
  isExpanded,
  setExpanded,
  totalDuration,
}: SlowestFunctionEntryProps) {
  const organization = useOrganization();

  const {projects} = useProjects();
  const project = projects.find(p => p.id === String(func['project.id']));

  const score = Math.ceil((((func['sum()'] as number) ?? 0) / totalDuration) * BARS);
  const palette = new Array(BARS).fill([CHART_PALETTE[0][0]]);

  const query = useMemo(() => {
    const conditions = new MutableSearch('');

    conditions.setFilterValues('is_application', ['1']);

    conditions.setFilterValues('project.id', [String(func['project.id'])]);
    conditions.setFilterValues('package', [String(func.package)]);
    conditions.setFilterValues('function', [String(func.function)]);

    return conditions.formatString();
  }, [func]);

  const functionTransactionsQuery = useProfileFunctions<FunctionTransactionField>({
    fields: functionTransactionsFields,
    referrer: 'api.profiling.suspect-functions.transactions',
    sort: {
      key: 'sum()',
      order: 'desc',
    },
    query,
    limit: 5,
    enabled: isExpanded,
  });

  return (
    <AccordionItemContainer>
      <AccordionItem>
        {project && <IdBadge project={project} avatarSize={16} hideName />}
        <FunctionName>{func.function}</FunctionName>
        <Tooltip
          title={tct('Appeared [count] times for a total self time of [totalSelfTime]', {
            count: <Count value={func['count()'] as number} />,
            totalSelfTime: (
              <PerformanceDuration nanoseconds={func['sum()'] as number} abbreviation />
            ),
          })}
        >
          <ScoreBar score={score} palette={palette} size={20} radius={0} />
        </Tooltip>
        <Button
          icon={<IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
          aria-label={t('Expand')}
          aria-expanded={isExpanded}
          size="zero"
          borderless
          onClick={() => setExpanded()}
        />
      </AccordionItem>
      {isExpanded && (
        <Fragment>
          {functionTransactionsQuery.isError && (
            <StatusContainer height="140px">
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </StatusContainer>
          )}
          {functionTransactionsQuery.isLoading && (
            <StatusContainer height="140px">
              <LoadingIndicator />
            </StatusContainer>
          )}
          {functionTransactionsQuery.isFetched && (
            <TransactionsList data-test-id="transactions-list">
              <TransactionsListHeader>
                <TextOverflow>{t('Transaction')}</TextOverflow>
              </TransactionsListHeader>
              <TransactionsListHeader align="right">
                <TextOverflow>{t('Count')}</TextOverflow>
              </TransactionsListHeader>
              <TransactionsListHeader align="right">
                <TextOverflow>{t('Total Self Time')}</TextOverflow>
              </TransactionsListHeader>
              {(functionTransactionsQuery.data?.data ?? []).map(transaction => {
                const examples = transaction['examples()'] as string[];
                let transactionCol = <Fragment>{transaction.transaction}</Fragment>;

                if (project && examples.length) {
                  const target = generateProfileFlamechartRouteWithQuery({
                    orgSlug: organization.slug,
                    projectSlug: project.slug,
                    profileId: examples[0],
                    query: {
                      frameName: func.function as string,
                      framePackage: func.package as string,
                    },
                  });
                  transactionCol = <Link to={target}>{transactionCol}</Link>;
                }

                return (
                  <Fragment key={transaction.transaction as string}>
                    <TransactionsListCell>
                      <TextOverflow>{transactionCol}</TextOverflow>
                    </TransactionsListCell>
                    <TransactionsListCell align="right">
                      <Count value={transaction['count()'] as number} />
                    </TransactionsListCell>
                    <TransactionsListCell align="right">
                      <PerformanceDuration
                        nanoseconds={transaction['sum()'] as number}
                        abbreviation
                      />
                    </TransactionsListCell>
                  </Fragment>
                );
              })}
            </TransactionsList>
          )}
        </Fragment>
      )}
    </AccordionItemContainer>
  );
}

const functionsFields = [
  'project.id',
  'package',
  'function',
  'count()',
  'sum()',
] as const;

type FunctionsField = (typeof functionsFields)[number];

const totalsFields = ['project.id', 'sum()'] as const;

type TotalsField = (typeof totalsFields)[number];

const functionTransactionsFields = [
  'transaction',
  'count()',
  'sum()',
  'examples()',
] as const;

type FunctionTransactionField = (typeof functionTransactionsFields)[number];

const Container = styled(Panel)`
  display: flex;
  flex-direction: column;
  padding-top: ${space(2)};
`;

const HeaderContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-left: ${space(2)};
  padding-right: ${space(2)};
`;

const StyledHeaderTitleLegend = styled(HeaderTitleLegend)`
  position: relative;
`;

const Subtitle = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  display: inline-block;
`;

const ContentContainer = styled('div')`
  flex: 1 1 auto;
`;

const Accordion = styled('ul')`
  padding: ${space(1)} 0 0 0;
  margin: 0;
  list-style-type: none;
  display: flex;
  flex-direction: column;
`;

const AccordionItemContainer = styled('li')`
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const AccordionItem = styled('div')`
  display: flex;
  gap: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const FunctionName = styled(TextOverflow)`
  flex: 1 1 auto;
`;

const TransactionsList = styled('div')`
  display: grid;
  grid-template-columns: 65% 10% 25%;
  padding: ${space(0)} ${space(2)};
`;

const TransactionsListHeader = styled('span')<{
  align?: CSSProperties['textAlign'];
}>`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: 600;
  color: ${p => p.theme.subText};
  text-align: ${p => p.align};
`;

const TransactionsListCell = styled('div')<{align?: CSSProperties['textAlign']}>`
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: ${p => p.align};
  padding: ${space(0.5)} 0px;
`;

const StatusContainer = styled('div')<{height: string}>`
  height: ${p => p.height};
  display: flex;
  align-items: center;
  justify-content: center;
`;
