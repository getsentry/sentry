import {Fragment} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Placeholder} from 'sentry/components/placeholder';
import {IconCopyId, IconEllipsis, IconOpen} from 'sentry/icons';
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

const COPY_ID_LABEL = t('Copy trace ID to clipboard');

interface TraceBreadcrumbsProps {
  organization: Organization;
  traceSlug: string;
  project?: Project;
  /** Omitted while the trace is still loading; prev/next then render disabled. */
  rootEventResults?: TraceRootEventQueryResults;
}

/**
 * The parent crumbs of the trace, keyed off the `source` query param.
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
 * Prev/next navigation between the traces of the same session. Always returned so
 * the chevrons hold their space, disabled when there is nowhere to go.
 */
function useTracePagination(rootEventResults?: TraceRootEventQueryResults) {
  const rootEvent = rootEventResults?.data;
  const hasTraceAttributes =
    isTraceItemDetailsResponse(rootEvent) && !!rootEvent.timestamp;

  // Both lookups run unconditionally to keep hook order stable. Without
  // attributes they resolve to a disabled query.
  const attributes = hasTraceAttributes ? rootEvent.attributes : [];
  const currentTraceStartTimestamp = hasTraceAttributes
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

  return {previous, next};
}

export function TraceBreadcrumbs({
  organization,
  traceSlug,
  project,
  rootEventResults,
}: TraceBreadcrumbsProps) {
  const queryParams = useTraceQueryParams();
  const traceEventView = useTraceEventView(traceSlug, queryParams);

  const parentItems = useTraceParentItems(organization);
  const pagination = useTracePagination(rootEventResults);
  const {copy} = useCopyToClipboard();
  // This header only renders on the standalone trace page, so the waterfall
  // source is always 'performance'.
  const exploreTarget = useTraceExploreTarget({
    traceSlug,
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
            ) : (
              <Placeholder width="16px" height="16px" />
            ),
            pagination,
            trailingActions: exploreTarget
              ? {
                  type: 'menu',
                  triggerLabel: t('Trace Actions'),
                  triggerIcon: <IconEllipsis />,
                  items: [
                    {
                      key: 'copy-trace-id',
                      label: COPY_ID_LABEL,
                      leadingItems: <IconCopyId variant="muted" />,
                      onAction: () => copy(traceSlug),
                    },
                    {
                      key: 'open-in-explore',
                      label: t('Open in Explore'),
                      leadingItems: <IconOpen variant="muted" />,
                      to: exploreTarget.to,
                      onAction: exploreTarget.onClick,
                    },
                  ],
                }
              : {
                  type: 'copy',
                  text: traceSlug,
                  label: COPY_ID_LABEL,
                  tooltip: COPY_ID_LABEL,
                  icon: <IconCopyId variant="muted" />,
                },
          }}
        />
      </TopBar.Slot>
    </Fragment>
  );
}
