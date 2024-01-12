import {CSSProperties, Fragment, ReactNode, useCallback, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Count from 'sentry/components/count';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import ScoreBar from 'sentry/components/scoreBar';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconChevron, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {Frame} from 'sentry/utils/profiling/frame';
import {EventsResultsDataRow} from 'sentry/utils/profiling/hooks/types';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {
  Accordion,
  AccordionItem,
  ContentContainer,
  HeaderContainer,
  HeaderTitleLegend,
  StatusContainer,
  Subtitle,
  WidgetContainer,
} from './styles';

const MAX_FUNCTIONS = 3;
const DEFAULT_CURSOR_NAME = 'slowFnCursor';

interface SlowestFunctionsWidgetProps {
  cursorName?: string;
  header?: ReactNode;
  userQuery?: string;
  widgetHeight?: string;
}

export function SlowestFunctionsWidget({
  cursorName = DEFAULT_CURSOR_NAME,
  header,
  userQuery,
  widgetHeight,
}: SlowestFunctionsWidgetProps) {
  const location = useLocation();

  const [expandedIndex, setExpandedIndex] = useState(0);

  const slowFnCursor = useMemo(
    () => decodeScalar(location.query[cursorName]),
    [cursorName, location.query]
  );

  const handleCursor = useCallback(
    (cursor, pathname, query) => {
      browserHistory.push({
        pathname,
        query: {...query, [cursorName]: cursor},
      });
    },
    [cursorName]
  );

  const functionsQuery = useProfileFunctions<FunctionsField>({
    fields: functionsFields,
    referrer: 'api.profiling.suspect-functions.list',
    sort: {
      key: 'sum()',
      order: 'desc',
    },
    query: userQuery,
    limit: MAX_FUNCTIONS,
    cursor: slowFnCursor,
  });

  const hasFunctions = (functionsQuery.data?.data?.length || 0) > 0;

  const totalsQuery = useProfileFunctions<TotalsField>({
    fields: totalsFields,
    referrer: 'api.profiling.suspect-functions.totals',
    sort: {
      key: 'sum()',
      order: 'desc',
    },
    query: userQuery,
    limit: MAX_FUNCTIONS,
    // make sure to query for the projects from the top functions
    projects: functionsQuery.isFetched
      ? [
          ...new Set(
            (functionsQuery.data?.data ?? []).map(func => func['project.id'] as number)
          ),
        ]
      : [],
    enabled: functionsQuery.isFetched && hasFunctions,
  });

  const isLoading = functionsQuery.isLoading || (hasFunctions && totalsQuery.isLoading);
  const isError = functionsQuery.isError || totalsQuery.isError;

  return (
    <WidgetContainer height={widgetHeight}>
      <HeaderContainer>
        {header ?? <HeaderTitleLegend>{t('Slowest Functions')}</HeaderTitleLegend>}
        <Subtitle>{t('Slowest functions by total self time spent.')}</Subtitle>
        <StyledPagination
          pageLinks={functionsQuery.getResponseHeader?.('Link') ?? null}
          size="xs"
          onCursor={handleCursor}
        />
      </HeaderContainer>
      <ContentContainer>
        {isLoading && (
          <StatusContainer>
            <LoadingIndicator />
          </StatusContainer>
        )}
        {isError && (
          <StatusContainer>
            <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
          </StatusContainer>
        )}
        {!isError && !isLoading && !hasFunctions && (
          <EmptyStateWarning>
            <p>{t('No functions found')}</p>
          </EmptyStateWarning>
        )}
        {hasFunctions && totalsQuery.isFetched && (
          <StyledAccordion>
            {(functionsQuery.data?.data ?? []).map((f, i, l) => {
              const projectEntry = totalsQuery.data?.data?.find(
                row => row['project.id'] === f['project.id']
              );
              const projectTotalDuration = projectEntry?.['sum()'] ?? f['sum()'];
              return (
                <SlowestFunctionEntry
                  key={`${f['project.id']}-${f.package}-${f.function}`}
                  isExpanded={i === expandedIndex}
                  setExpanded={() => {
                    const nextIndex = expandedIndex !== i ? i : (i + 1) % l.length;
                    setExpandedIndex(nextIndex);
                  }}
                  func={f}
                  totalDuration={projectTotalDuration as number}
                  query={userQuery ?? ''}
                />
              );
            })}
          </StyledAccordion>
        )}
      </ContentContainer>
    </WidgetContainer>
  );
}

interface SlowestFunctionEntryProps {
  func: EventsResultsDataRow<FunctionsField>;
  isExpanded: boolean;
  query: string;
  setExpanded: () => void;
  totalDuration: number;
}

const BARS = 10;

function SlowestFunctionEntry({
  func,
  isExpanded,
  query,
  setExpanded,
  totalDuration,
}: SlowestFunctionEntryProps) {
  const organization = useOrganization();

  const {projects} = useProjects();
  const project = projects.find(p => p.id === String(func['project.id']));

  const score = Math.ceil((((func['sum()'] as number) ?? 0) / totalDuration) * BARS);
  const palette = new Array(BARS).fill([CHART_PALETTE[0][0]]);

  const frame = useMemo(() => {
    return new Frame(
      {
        key: 0,
        name: func.function as string,
        package: func.package as string,
      },
      // Ensures that the frame runs through the normalization code path
      project?.platform && /node|javascript/.test(project.platform)
        ? project.platform
        : undefined,
      'aggregate'
    );
  }, [func, project]);

  const userQuery = useMemo(() => {
    const conditions = new MutableSearch(query);

    conditions.setFilterValues('project.id', [String(func['project.id'])]);
    // it is more efficient to filter on the fingerprint
    // than it is to filter on the package + function
    conditions.setFilterValues('fingerprint', [String(func.fingerprint)]);

    return conditions.formatString();
  }, [func, query]);

  const functionTransactionsQuery = useProfileFunctions<FunctionTransactionField>({
    fields: functionTransactionsFields,
    referrer: 'api.profiling.suspect-functions.transactions',
    sort: {
      key: 'sum()',
      order: 'desc',
    },
    query: userQuery,
    limit: 5,
    enabled: isExpanded,
  });

  return (
    <Fragment>
      <StyledAccordionItem>
        {project && (
          <Tooltip title={project.name}>
            <IdBadge project={project} avatarSize={16} hideName />
          </Tooltip>
        )}
        <FunctionName>
          <Tooltip title={frame.package}>{frame.name}</Tooltip>
        </FunctionName>
        <Tooltip
          title={tct('Appeared [count] times for a total time spent of [totalSelfTime]', {
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
          onClick={setExpanded}
        />
      </StyledAccordionItem>
      {isExpanded && (
        <Fragment>
          {functionTransactionsQuery.isError && (
            <StatusContainer>
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </StatusContainer>
          )}
          {functionTransactionsQuery.isLoading && (
            <StatusContainer>
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
                <TextOverflow>{t('P75()')}</TextOverflow>
              </TransactionsListHeader>
              <TransactionsListHeader align="right">
                <TextOverflow>{t('Time Spent')}</TextOverflow>
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
                      frameName: frame.name,
                      framePackage: frame.package,
                    },
                  });
                  transactionCol = (
                    <Link
                      to={target}
                      onClick={() => {
                        trackAnalytics('profiling_views.go_to_flamegraph', {
                          organization,
                          source: 'profiling.global_suspect_functions',
                        });
                      }}
                    >
                      {transactionCol}
                    </Link>
                  );
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
                        nanoseconds={transaction['p75()'] as number}
                        abbreviation
                      />
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
    </Fragment>
  );
}

const functionsFields = [
  'project.id',
  'fingerprint',
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
  'p75()',
  'sum()',
  'examples()',
] as const;

type FunctionTransactionField = (typeof functionTransactionsFields)[number];

const StyledPagination = styled(Pagination)`
  margin: 0;
`;

const StyledAccordion = styled(Accordion)`
  display: flex;
  flex-direction: column;
`;

const StyledAccordionItem = styled(AccordionItem)`
  display: grid;
  grid-template-columns: auto 1fr auto auto;
`;

const FunctionName = styled(TextOverflow)`
  flex: 1 1 auto;
`;

const TransactionsList = styled('div')`
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  grid-template-rows: 18px auto auto auto auto auto;
  column-gap: ${space(1)};
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
