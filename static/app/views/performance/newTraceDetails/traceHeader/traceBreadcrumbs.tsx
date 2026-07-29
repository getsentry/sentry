import {Fragment} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {TopBar} from 'sentry/views/navigation/topBar';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {getTraceViewParentCrumbs} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {useAdjacentTraceNavigation} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/useAdjacentTraceNavigation';
import {useTraceEventView} from 'sentry/views/performance/newTraceDetails/useTraceEventView';
import {useTraceExploreTarget} from 'sentry/views/performance/newTraceDetails/useTraceExploreTarget';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

interface TraceBreadcrumbsProps {
  organization: Organization;
  traceSlug: string;
  project?: Project;
  /** Omitted while the trace is still loading, which hides prev/next navigation. */
  rootEventResults?: TraceRootEventQueryResults;
}

/**
 * The parent crumbs of the trace, keyed off the `source` query param. Sources
 * that contribute a label without a destination are dropped — the page title
 * already names the trace.
 */
function useTraceParentItems(organization: Organization) {
  const location = useLocation();
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);

  return getTraceViewParentCrumbs({
    organization,
    location,
    moduleURLBuilder,
    view,
  }).flatMap(crumb =>
    crumb.to ? [{type: 'link' as const, label: crumb.label, to: crumb.to}] : []
  );
}

/**
 * Prev/next navigation between the traces of the same session. Returns
 * undefined when the root event carries no linked-trace attributes, in which
 * case the chevrons are left out entirely rather than rendered disabled.
 */
function useTracePagination(rootEventResults?: TraceRootEventQueryResults) {
  const rootEvent = rootEventResults?.data;
  const hasLinkedTraces = isTraceItemDetailsResponse(rootEvent) && !!rootEvent.timestamp;

  // Both lookups run unconditionally to keep hook order stable. Without
  // attributes they resolve to a disabled query.
  const attributes = hasLinkedTraces ? rootEvent.attributes : [];
  const currentTraceStartTimestamp = hasLinkedTraces
    ? new Date(rootEvent.timestamp).getTime() / 1000
    : 0;

  const previous = useAdjacentTraceNavigation({
    direction: 'previous',
    attributes,
    currentTraceStartTimestamp,
  });
  const next = useAdjacentTraceNavigation({
    direction: 'next',
    attributes,
    currentTraceStartTimestamp,
  });

  return hasLinkedTraces ? {previous, next} : undefined;
}

export function TraceBreadcrumbs({
  organization,
  traceSlug,
  project,
  rootEventResults,
}: TraceBreadcrumbsProps) {
  const queryParams = useTraceQueryParams();
  const traceEventView = useTraceEventView(traceSlug, queryParams);
  const {copy} = useCopyToClipboard();

  const parentItems = useTraceParentItems(organization);
  const pagination = useTracePagination(rootEventResults);
  // This header only renders on the standalone trace page, so the waterfall
  // source is always 'performance'.
  const exploreTarget = useTraceExploreTarget({
    trace_id: traceSlug,
    traceEventView,
    source: 'performance',
  });

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList items={parentItems} />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title
          item={{
            type: 'page-title',
            label: formatVersion(traceSlug),
            leadingGraphic: project ? (
              <ProjectBadge
                hideName
                disableLink
                project={project}
                avatarSize={16}
                avatarProps={{hasTooltip: true, tooltip: project.slug}}
              />
            ) : undefined,
            pagination,
            trailingActions: {
              type: 'menu',
              triggerLabel: t('Trace Actions'),
              triggerIcon: <IconEllipsis />,
              items: [
                {
                  key: 'copy-trace-id',
                  label: t('Copy ID'),
                  onAction: () =>
                    copy(traceSlug, {
                      successMessage: t('Copied trace ID to clipboard'),
                    }),
                },
                ...(exploreTarget
                  ? [
                      {
                        key: 'open-in-explore',
                        label: t('Open in Explore'),
                        to: exploreTarget.to,
                        onAction: exploreTarget.onClick,
                      },
                    ]
                  : []),
              ],
            },
          }}
        />
      </TopBar.Slot>
    </Fragment>
  );
}
