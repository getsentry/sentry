import type {ReactNode} from 'react';
import {Fragment, useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart} from 'sentry/components/charts/lineChart';
import Count from 'sentry/components/count';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import ScoreBar from 'sentry/components/scoreBar';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tct} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {EventsStatsSeries} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {browserHistory} from 'sentry/utils/browserHistory';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {getShortEventId} from 'sentry/utils/events';
import {Frame} from 'sentry/utils/profiling/frame';
import type {EventsResultsDataRow} from 'sentry/utils/profiling/hooks/types';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {useProfileTopEventsStats} from 'sentry/utils/profiling/hooks/useProfileTopEventsStats';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {getProfileTargetId} from 'sentry/views/profiling/utils';

import {MAX_FUNCTIONS} from './constants';
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

const DEFAULT_CURSOR_NAME = 'slowFnCursor';

type BreakdownFunction = 'avg()' | 'p50()' | 'p75()' | 'p95()' | 'p99()';
type ChartFunctions<F extends BreakdownFunction> = F | 'all_examples()';

interface SlowestFunctionsWidgetProps<F extends BreakdownFunction> {
  breakdownFunction: F;
  cursorName?: string;
  header?: ReactNode;
  userQuery?: string;
  widgetHeight?: string;
}

export function SlowestFunctionsWidget<F extends BreakdownFunction>({
  breakdownFunction,
  cursorName = DEFAULT_CURSOR_NAME,
  header,
  userQuery,
  widgetHeight,
}: SlowestFunctionsWidgetProps<F>) {
  const location = useLocation();

  const [expandedIndex, setExpandedIndex] = useState(0);

  const slowFnCursor = useMemo(
    () => decodeScalar(location.query[cursorName]),
    [cursorName, location.query]
  );

  const handleCursor = useCallback(
    (cursor: any, pathname: any, query: any) => {
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

  const functionsData = functionsQuery.data?.data || [];

  const hasFunctions = (functionsData.length || 0) > 0;

  // make sure to query for the projects from the top functions
  const projects = functionsQuery.isFetched
    ? [
        ...new Set(
          (functionsQuery.data?.data ?? []).map(func => func['project.id'] as number)
        ),
      ]
    : [];

  const totalsQuery = useProfileFunctions<TotalsField>({
    fields: totalsFields,
    referrer: 'api.profiling.suspect-functions.totals',
    sort: {
      key: 'sum()',
      order: 'desc',
    },
    query: userQuery,
    limit: MAX_FUNCTIONS,
    projects,
    enabled: functionsQuery.isFetched && hasFunctions,
  });

  const isLoading = functionsQuery.isPending || (hasFunctions && totalsQuery.isPending);
  const isError = functionsQuery.isError || totalsQuery.isError;

  const functionStats = useProfileTopEventsStats({
    dataset: 'profileFunctions',
    fields: ['fingerprint', 'all_examples()', breakdownFunction],
    query: functionsData.map(f => `fingerprint:${f.fingerprint}`).join(' OR '),
    referrer: 'api.profiling.suspect-functions.stats',
    yAxes: ['all_examples()', breakdownFunction],
    projects,
    others: false,
    topEvents: functionsData.length,
    enabled: totalsQuery.isFetched && hasFunctions,
  });

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
          <Accordion>
            {functionsData.map((f, i, l) => {
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
                  stats={functionStats}
                  totalDuration={projectTotalDuration as number}
                  query={userQuery ?? ''}
                />
              );
            })}
          </Accordion>
        )}
      </ContentContainer>
    </WidgetContainer>
  );
}

interface SlowestFunctionEntryProps<F extends BreakdownFunction> {
  breakdownFunction: BreakdownFunction;
  func: EventsResultsDataRow<FunctionsField>;
  isExpanded: boolean;
  query: string;
  setExpanded: () => void;
  totalDuration: number;
  stats?: UseApiQueryResult<EventsStatsSeries<ChartFunctions<F>>, RequestError>;
}

const BARS = 10;

function SlowestFunctionEntry<F extends BreakdownFunction>({
  breakdownFunction,
  func,
  isExpanded,
  setExpanded,
  stats,
  totalDuration,
}: SlowestFunctionEntryProps<F>) {
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

  const examples: MenuItemProps[] = useMemo(() => {
    const rawExamples = stats?.data?.data?.find(
      s => s.axis === 'all_examples()' && s.label === String(func.fingerprint)
    );

    if (!defined(rawExamples?.values)) {
      return [];
    }

    const timestamps = stats?.data?.timestamps ?? [];

    return rawExamples.values
      .map(values => (Array.isArray(values) ? values : []))
      .flatMap((example, i) => {
        const timestamp = (
          <TimeSince
            unitStyle="extraShort"
            date={timestamps[i]! * 1000}
            tooltipShowSeconds
          />
        );
        return example.slice(0, 1).map(profileRef => {
          const targetId = getProfileTargetId(profileRef);
          return {
            key: targetId,
            label: (
              <DropdownItem>
                {getShortEventId(targetId)}
                {timestamp}
              </DropdownItem>
            ),
            textValue: targetId,
            to: generateProfileRouteFromProfileReference({
              orgSlug: organization.slug,
              projectSlug: project?.slug || '',
              reference: profileRef,
              frameName: frame.name,
              framePackage: frame.package,
            }),
          };
        });
      })
      .reverse()
      .slice(0, 10);
  }, [func, stats, organization, project, frame]);

  return (
    <Fragment>
      <AccordionItem>
        <Button
          icon={<IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
          aria-label={t('Expand')}
          aria-expanded={isExpanded}
          size="zero"
          borderless
          onClick={setExpanded}
        />
        {project && (
          <Tooltip title={project.slug}>
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
        <DropdownMenu
          position="bottom-end"
          triggerProps={{
            icon: <IconEllipsis size="xs" />,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
          items={examples}
          menuTitle={t('Example Profiles')}
        />
      </AccordionItem>
      {isExpanded && (
        <FunctionChartContainer>
          <FunctionChart
            func={func}
            breakdownFunction={breakdownFunction}
            stats={stats}
          />
        </FunctionChartContainer>
      )}
    </Fragment>
  );
}

interface FunctionChartProps<F extends BreakdownFunction> {
  breakdownFunction: F;
  func: EventsResultsDataRow<FunctionsField>;
  stats?: UseApiQueryResult<EventsStatsSeries<ChartFunctions<F>>, RequestError>;
}

function FunctionChart<F extends BreakdownFunction>({
  breakdownFunction,
  func,
  stats,
}: FunctionChartProps<F>) {
  const {selection} = usePageFilters();
  const theme = useTheme();

  const series: Series[] = useMemo(() => {
    const timestamps = stats?.data?.timestamps ?? [];
    const rawData = stats?.data?.data?.find(
      s => s.axis === breakdownFunction && s.label === String(func.fingerprint)
    );

    if (!defined(rawData?.values)) {
      return [];
    }

    return [
      {
        data: timestamps.map((timestamp, i) => {
          return {
            name: timestamp * 1000,
            value: rawData.values[i]!,
          };
        }),
        seriesName: breakdownFunction,
      },
    ];
  }, [breakdownFunction, func, stats]);

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

  if (stats?.isPending) {
    return (
      <StatusContainer>
        <LoadingIndicator />
      </StatusContainer>
    );
  }

  if (stats?.isError) {
    return (
      <StatusContainer>
        <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
      </StatusContainer>
    );
  }

  return (
    <ChartZoom {...selection.datetime}>
      {zoomRenderProps => (
        <LineChart
          data-test-id="function-chart"
          {...zoomRenderProps}
          {...chartOptions}
          series={series}
        />
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

const FunctionName = styled(TextOverflow)`
  flex: 1 1 auto;
`;

const FunctionChartContainer = styled('div')`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const DropdownItem = styled('div')`
  width: 150px;
  display: flex;
  justify-content: space-between;
`;
