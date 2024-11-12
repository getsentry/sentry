import type {ReactNode} from 'react';
import {Fragment, useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart} from 'sentry/components/charts/lineChart';
import Count from 'sentry/components/count';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import ScoreBar from 'sentry/components/scoreBar';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconChevron, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {browserHistory} from 'sentry/utils/browserHistory';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {Frame} from 'sentry/utils/profiling/frame';
import type {EventsResultsDataRow} from 'sentry/utils/profiling/hooks/types';
import {useProfileEventsStats} from 'sentry/utils/profiling/hooks/useProfileEventsStats';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
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

type BreakdownFunction = 'avg()' | 'p50()' | 'p75()' | 'p95()' | 'p99()';

interface SlowestFunctionsWidgetProps {
  breakdownFunction: BreakdownFunction;
  cursorName?: string;
  header?: ReactNode;
  userQuery?: string;
  widgetHeight?: string;
}

export function SlowestFunctionsWidget({
  breakdownFunction,
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

  const isLoading = functionsQuery.isPending || (hasFunctions && totalsQuery.isPending);
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
                  breakdownFunction={breakdownFunction}
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
  breakdownFunction: BreakdownFunction;
  func: EventsResultsDataRow<FunctionsField>;
  isExpanded: boolean;
  query: string;
  setExpanded: () => void;
  totalDuration: number;
}

const BARS = 10;

function SlowestFunctionEntry({
  breakdownFunction,
  func,
  isExpanded,
  setExpanded,
  totalDuration,
}: SlowestFunctionEntryProps) {
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
        <FunctionChartContainer>
          <FunctionChart func={func} breakdownFunction={breakdownFunction} />
        </FunctionChartContainer>
      )}
    </Fragment>
  );
}

interface FunctionChartProps {
  breakdownFunction: BreakdownFunction;
  func: EventsResultsDataRow<FunctionsField>;
}

function FunctionChart({breakdownFunction, func}: FunctionChartProps) {
  const {selection} = usePageFilters();
  const theme = useTheme();

  const functionStats = useProfileEventsStats({
    dataset: 'profileFunctions',
    query: `fingerprint:${func.fingerprint}`,
    referrer: 'api.profiling.suspect-functions.stats',
    yAxes: [breakdownFunction],
  });

  const series: Series[] = useMemo(() => {
    const timestamps = functionStats.data?.timestamps ?? [];
    const allData = (functionStats.data?.data ?? []).filter(
      data => data.axis === breakdownFunction
    );

    return allData.map(data => {
      return {
        data: timestamps.map((timestamp, i) => {
          return {
            name: timestamp * 1000,
            value: data.values[i],
          };
        }),
        seriesName: data.axis,
      };
    });
  }, [breakdownFunction, functionStats]);

  const chartOptions = useMemo(() => {
    return {
      height: 150,
      grid: {
        top: '10px',
        bottom: '10px',
        left: '10px',
        right: '10px',
      },
      yAxis: {
        axisLabel: {
          color: theme.chartLabel,
          formatter: (value: number) => axisLabelFormatter(value, 'duration'),
        },
      },
      xAxis: {
        type: 'time' as const,
      },
      tooltip: {
        valueFormatter: (value: number) => tooltipFormatter(value, 'duration'),
      },
    };
  }, [theme.chartLabel]);

  return (
    <ChartZoom {...selection.datetime}>
      {zoomRenderProps => (
        <LineChart {...zoomRenderProps} {...chartOptions} series={series} />
      )}
    </ChartZoom>
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

const FunctionChartContainer = styled('div')`
  flex: 1 1 auto;
`;
