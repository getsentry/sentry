import type {Dispatch, SetStateAction} from 'react';
import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/button';
import Count from 'sentry/components/count';
import EmptyStateWarning, {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_PER_PAGE, SPAN_PROPS_DOCS_URL} from 'sentry/constants';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {
  useExploreDataset,
  useExploreQuery,
  useExploreTitle,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {useAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {type TraceResult, useTraces} from 'sentry/views/explore/hooks/useTraces';
import {
  Description,
  ProjectBadgeWrapper,
  ProjectsRenderer,
  SpanTimeRenderer,
  TraceBreakdownRenderer,
  TraceIdRenderer,
} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';
import {SpanTable} from 'sentry/views/explore/tables/tracesTable/spansTable';
import {
  BreakdownPanelItem,
  EmptyStateText,
  EmptyValueContainer,
  StyledPanel,
  StyledPanelHeader,
  StyledPanelItem,
  TracePanelContent,
  WrappingText,
} from 'sentry/views/explore/tables/tracesTable/styles';

interface TracesTableProps {
  confidences: Confidence[];
  setError: Dispatch<SetStateAction<string>>;
}

export function TracesTable({confidences, setError}: TracesTableProps) {
  const title = useExploreTitle();
  const dataset = useExploreDataset();
  const query = useExploreQuery();
  const visualizes = useExploreVisualizes();
  const organization = useOrganization();

  const location = useLocation();
  const cursor = decodeScalar(location.query.cursor);

  const result = useTraces({
    dataset,
    query,
    limit: DEFAULT_PER_PAGE,
    sort: '-timestamp',
    cursor,
  });

  useEffect(() => {
    setError(result.error?.message ?? '');
  }, [setError, result.error?.message]);

  useAnalytics({
    dataset,
    resultLength: result.data?.data?.length,
    resultMode: 'trace samples',
    resultStatus: result.status,
    resultMissingRoot: result.data?.data?.filter(trace => !defined(trace.name))?.length,
    visualizes,
    organization,
    columns: [
      'trace id',
      'trace root',
      'total spans',
      'timeline',
      'root duration',
      'timestamp',
    ],
    userQuery: query,
    confidences,
    title,
  });

  const {data, isPending, isError, getResponseHeader} = result;

  const showErrorState = !isPending && isError;
  const showEmptyState = !isPending && !showErrorState && (data?.data?.length ?? 0) === 0;

  return (
    <Fragment>
      <StyledPanel>
        <TracePanelContent>
          <StyledPanelHeader align="left" lightText>
            {t('Trace ID')}
          </StyledPanelHeader>
          <StyledPanelHeader align="left" lightText>
            {t('Trace Root')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {!query ? t('Total Spans') : t('Matching Spans')}
          </StyledPanelHeader>
          <StyledPanelHeader align="left" lightText>
            {t('Timeline')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Root Duration')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Timestamp')}
          </StyledPanelHeader>
          {isPending && (
            <StyledPanelItem span={6} overflow>
              <LoadingIndicator />
            </StyledPanelItem>
          )}
          {showErrorState && (
            <StyledPanelItem span={6} overflow>
              <WarningStreamWrapper>
                <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
              </WarningStreamWrapper>
            </StyledPanelItem>
          )}
          {showEmptyState && (
            <StyledPanelItem span={6} overflow>
              <EmptyStateWarning withIcon>
                <EmptyStateText size="fontSizeExtraLarge">
                  {t('No trace results found')}
                </EmptyStateText>
                <EmptyStateText size="fontSizeMedium">
                  {tct('Try adjusting your filters or refer to [docSearchProps].', {
                    docSearchProps: (
                      <ExternalLink href={SPAN_PROPS_DOCS_URL}>
                        {t('docs for search properties')}
                      </ExternalLink>
                    ),
                  })}
                </EmptyStateText>
              </EmptyStateWarning>
            </StyledPanelItem>
          )}
          {data?.data?.map((trace, i) => (
            <TraceRow
              key={trace.trace}
              trace={trace}
              defaultExpanded={query && i === 0}
              query={query}
            />
          ))}
        </TracePanelContent>
      </StyledPanel>
      <Pagination pageLinks={getResponseHeader?.('Link')} />
    </Fragment>
  );
}

function TraceRow({
  defaultExpanded,
  trace,
  query,
}: {
  defaultExpanded;
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
    const seenProjects: Set<string> = new Set();

    const leadingProjects: string[] = [];
    const trailingProjects: string[] = [];

    for (let i = 0; i < trace.breakdowns.length; i++) {
      const project = trace.breakdowns[i]!.project;
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

  return (
    <Fragment>
      <StyledPanelItem align="center" center onClick={onClickExpand}>
        <StyledButton
          icon={<IconChevron size="xs" direction={expanded ? 'down' : 'right'} />}
          aria-label={t('Toggle trace details')}
          aria-expanded={expanded}
          size="zero"
          borderless
          onClick={() =>
            trackAnalytics('trace_explorer.toggle_trace_details', {
              organization,
              expanded,
              source: 'new explore',
            })
          }
        />
        <TraceIdRenderer
          traceId={trace.trace}
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
      </StyledPanelItem>
      <StyledPanelItem align="left" overflow>
        <Tooltip title={trace.name} containerDisplayMode="block" showOnlyOnOverflow>
          <Description>
            <ProjectBadgeWrapper>
              <ProjectsRenderer
                projectSlugs={
                  traceProjects.length > 0
                    ? traceProjects
                    : trace.project
                      ? [trace.project]
                      : []
                }
              />
            </ProjectBadgeWrapper>
            {trace.name ? (
              <WrappingText>{trace.name}</WrappingText>
            ) : (
              <EmptyValueContainer>{t('Missing Trace Root')}</EmptyValueContainer>
            )}
          </Description>
        </Tooltip>
      </StyledPanelItem>
      <StyledPanelItem align="right">
        {query ? (
          tct('[numerator][space]of[space][denominator]', {
            numerator: <Count value={trace.matchingSpans} />,
            denominator: <Count value={trace.numSpans} />,
            space: <Fragment>&nbsp;</Fragment>,
          })
        ) : (
          <Count value={trace.numSpans} />
        )}
      </StyledPanelItem>
      <Breakdown trace={trace} />
      <StyledPanelItem align="right">
        {defined(trace.rootDuration) ? (
          <PerformanceDuration milliseconds={trace.rootDuration} abbreviation />
        ) : (
          <EmptyValueContainer />
        )}
      </StyledPanelItem>
      <StyledPanelItem align="right">
        <SpanTimeRenderer timestamp={trace.end} tooltipShowSeconds />
      </StyledPanelItem>
      {expanded && <SpanTable trace={trace} />}
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
    <BreakdownPanelItem
      align="right"
      highlightedSliceName={highlightedSliceName}
      onMouseLeave={() => setHighlightedSliceName('')}
    >
      <TraceBreakdownRenderer
        trace={trace}
        setHighlightedSliceName={setHighlightedSliceName}
      />
    </BreakdownPanelItem>
  );
}

const StyledButton = styled(Button)`
  margin-right: ${space(0.5)};
`;

const WarningStreamWrapper = styled(EmptyStreamWrapper)`
  > svg {
    fill: ${p => p.theme.gray300};
  }
`;
