import {Fragment, useCallback, useMemo, useState} from 'react';
import debounce from 'lodash/debounce';

import {Button} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PerformanceDuration} from 'sentry/components/performanceDuration';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {SPAN_PROPS_DOCS_URL} from 'sentry/constants';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {usePaginationAnalytics} from 'sentry/views/explore/hooks/usePaginationAnalytics';
import type {TraceResult} from 'sentry/views/explore/hooks/useTraces';
import {useQueryParamsQuery} from 'sentry/views/explore/queryParams/context';
import {
  Description,
  ProjectBadgeWrapper,
  ProjectsRenderer,
  SpanTimeRenderer,
  TraceBreakdownRenderer,
  TraceIdRenderer,
} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';
import {
  BreakdownCell,
  EmptyStateText,
  EmptyValueContainer,
  WrappingText,
} from 'sentry/views/explore/tables/tracesTable/styles';
import {TraceSpansTable} from 'sentry/views/explore/tables/tracesTable/traceSpansTable';

const TRACES_TABLE_COLUMNS: TableColumnConfig[] = [
  {key: 'trace', width: 'min-content'},
  {key: 'root', width: 'minmax(105px, auto)'},
  {key: 'spans', width: 'min-content'},
  {key: 'timeline', width: 'min-content'},
  {key: 'duration', width: 'min-content'},
  {key: 'timestamp', width: 'min-content'},
];

interface TracesTableProps {
  tracesTableResult: TracesTableResult;
}

export function TracesTable({tracesTableResult}: TracesTableProps) {
  const query = useQueryParamsQuery();

  const {result} = tracesTableResult;
  const {isPending, isError} = result;
  const data = result.data?.json;

  const showErrorState = !isPending && isError;
  const showEmptyState = !isPending && !showErrorState && (data?.data?.length ?? 0) === 0;

  const paginationAnalyticsEvent = usePaginationAnalytics(
    'traces',
    data?.data?.length ?? 0
  );

  return (
    <Fragment>
      <SimpleTable
        aria-label={t('Trace samples')}
        columns={TRACES_TABLE_COLUMNS}
        scrollable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Trace ID')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Trace Root')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell align="right">
              {query ? t('Matching Spans') : t('Total Spans')}
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Timeline')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell align="right">
              {t('Root Duration')}
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell align="right" sort="desc">
              {t('Timestamp')}
            </SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isPending && <SimpleTable.Loading />}
        {showErrorState && (
          <SimpleTable.Empty>
            <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
          </SimpleTable.Empty>
        )}
        {showEmptyState && (
          <SimpleTable.Empty>
            <EmptyStateWarning>
              <EmptyStateText size="xl">{t('No trace results found')}</EmptyStateText>
              <EmptyStateText size="md">
                {tct('Try adjusting your filters or refer to [docSearchProps].', {
                  docSearchProps: (
                    <ExternalLink href={SPAN_PROPS_DOCS_URL}>
                      {t('docs for search properties')}
                    </ExternalLink>
                  ),
                })}
              </EmptyStateText>
            </EmptyStateWarning>
          </SimpleTable.Empty>
        )}
        {data?.data?.map((trace, i) => (
          <TraceRow
            key={trace.trace}
            trace={trace}
            defaultExpanded={query && i === 0}
            query={query}
          />
        ))}
      </SimpleTable>
      <Pagination
        pageLinks={result.data?.headers.Link}
        paginationAnalyticsEvent={paginationAnalyticsEvent}
      />
    </Fragment>
  );
}

function TraceRow({
  defaultExpanded,
  trace,
  query,
}: {
  defaultExpanded: any;
  query: string;
  trace: TraceResult;
}) {
  const {selection} = usePageFilters();
  const {projects} = useProjects();
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const location = useLocation();
  const organization = useOrganization();

  const onClickExpand = useCallback(() => setExpanded(e => !e), [setExpanded]);

  const selectedProjects = useMemo(() => {
    const selectedProjectIds = new Set(
      selection.projects.map(project => project.toString())
    );
    return new Set(
      projects
        .filter(project => selectedProjectIds.has(project.id))
        .map(project => project.slug)
    );
  }, [projects, selection.projects]);

  const traceProjects = useMemo(() => {
    const seenProjects = new Set<string>();

    const leadingProjects: string[] = [];
    const trailingProjects: string[] = [];

    for (const breakdown of trace.breakdowns) {
      const project = breakdown.project;
      if (!defined(project) || seenProjects.has(project)) {
        continue;
      }
      seenProjects.add(project);

      // Priotize projects that are selected in the page filters
      if (selectedProjects.has(project)) {
        leadingProjects.push(project);
      } else {
        trailingProjects.push(project);
      }
    }

    return [...leadingProjects, ...trailingProjects];
  }, [selectedProjects, trace]);

  const projectSlugs =
    traceProjects.length > 0 ? traceProjects : trace.project ? [trace.project] : [];

  return (
    <Fragment>
      <SimpleTable.Row>
        <SimpleTable.RowCell gap="xs" onClick={onClickExpand}>
          <Button
            icon={<IconChevron size="xs" direction={expanded ? 'down' : 'right'} />}
            aria-label={t('Toggle trace details')}
            aria-expanded={expanded}
            size="zero"
            variant="transparent"
            onClick={() =>
              trackAnalytics('trace_explorer.toggle_trace_details', {
                organization,
                expanded,
                source: 'new explore',
              })
            }
          />
          <TraceIdRenderer
            projectSlugs={projectSlugs}
            traceId={trace.trace}
            traceName={trace.name}
            timestamp={trace.end}
            onClick={event => {
              event.stopPropagation();
              trackAnalytics('trace_explorer.open_trace', {
                organization,
                source: 'new explore',
              });
            }}
            location={location}
          />
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <Tooltip title={trace.name} containerDisplayMode="block" showOnlyOnOverflow>
            <Description>
              <ProjectBadgeWrapper>
                <ProjectsRenderer projectSlugs={projectSlugs} />
              </ProjectBadgeWrapper>
              {trace.name ? (
                <WrappingText>{trace.name}</WrappingText>
              ) : (
                <EmptyValueContainer>{t('Missing Trace Root')}</EmptyValueContainer>
              )}
            </Description>
          </Tooltip>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">
          {query ? (
            tct('[numerator][space]of[space][denominator]', {
              numerator: <Count value={trace.matchingSpans} />,
              denominator: <Count value={trace.numSpans} />,
              space: <Fragment>&nbsp;</Fragment>,
            })
          ) : (
            <Count value={trace.numSpans} />
          )}
        </SimpleTable.RowCell>
        <Breakdown trace={trace} />
        <SimpleTable.RowCell justify="end">
          {defined(trace.rootDuration) ? (
            <PerformanceDuration milliseconds={trace.rootDuration} abbreviation />
          ) : (
            <EmptyValueContainer />
          )}
        </SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">
          <SpanTimeRenderer timestamp={trace.start} tooltipShowSeconds />
        </SimpleTable.RowCell>
      </SimpleTable.Row>
      {expanded && <TraceSpansTable trace={trace} />}
    </Fragment>
  );
}

function Breakdown({trace}: {trace: TraceResult}) {
  const [highlightedSliceName, _setHighlightedSliceName] = useState('');
  const setHighlightedSliceName = useMemo(
    () =>
      debounce(sliceName => _setHighlightedSliceName(sliceName), 100, {
        leading: true,
      }),
    [_setHighlightedSliceName]
  );

  return (
    <BreakdownCell
      highlightedSliceName={highlightedSliceName}
      onMouseLeave={() => setHighlightedSliceName('')}
    >
      <TraceBreakdownRenderer
        trace={trace}
        setHighlightedSliceName={setHighlightedSliceName}
      />
    </BreakdownCell>
  );
}
