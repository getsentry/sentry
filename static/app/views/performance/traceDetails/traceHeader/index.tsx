import {Fragment} from 'react';

import {EntityHeader} from '@sentry/scraps/entityHeader';
import type {EntityHeaderLeadingGraphic} from '@sentry/scraps/entityHeader';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {useProjects} from 'sentry/utils/useProjects';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {TopBar} from 'sentry/views/navigation/topBar';
import type {TraceMetaQueryResults} from 'sentry/views/performance/traceDetails/traceApi/useTraceMeta';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/traceDetails/traceApi/useTraceRootEvent';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {useTraceContextSections} from 'sentry/views/performance/traceDetails/useTraceContextSections';
import type {TraceOverviewData} from 'sentry/views/performance/traceDetails/useTraceOverviewData';
import {useTraceQueryParams} from 'sentry/views/performance/traceDetails/useTraceQueryParams';

import {TraceBreadcrumbs} from './traceBreadcrumbs';
import {
  getReplayId,
  getTraceMetadataItems,
  getTraceProperties,
  getTraceStatItems,
  getTraceTitle,
} from './traceEntityHeaderItems';

export interface TraceMetadataHeaderProps {
  metaResults: TraceMetaQueryResults;
  organization: Organization;
  overview: TraceOverviewData;
  rootEventResults: TraceRootEventQueryResults;
  traceSlug: string;
  tree: TraceTree;
}

const traceViewFeedbackOptions = {
  messagePlaceholder: t('How can we make the trace view better for you?'),
  tags: {'feedback.source': 'trace-view', 'feedback.owner': 'performance'},
};

const STATS_LABEL = t('Trace stats');
const METADATA_LABEL = t('Trace properties');

export function TraceMetaDataHeader(props: TraceMetadataHeaderProps) {
  const logsEnabled = isLogsEnabled(props.organization);
  const metricsEnabled = canUseMetricsUI(props.organization);
  const {projects} = useProjects();
  const {timestamp} = useTraceQueryParams();
  const {hasLogs, hasMetrics} = useTraceContextSections({
    tree: props.tree,
    logs: props.overview.logs.representative,
    logsCount: props.overview.logs.count,
    metrics: undefined,
    metricsCount: props.overview.metrics.count,
    meta: props.metaResults.data,
    logsEnabled,
    metricsEnabled,
  });

  const isTreeError = props.tree.type === 'error';
  const isRepresentativeLoading = props.overview.isRepresentativeLoading;
  // A failed meta request doesn't hold the header: its counts fall back to the
  // tree and the overview.
  const isLoading =
    props.tree.type === 'loading' ||
    (props.metaResults.status === 'pending' && !isTreeError) ||
    isRepresentativeLoading;
  const noEvents =
    props.tree.type === 'empty' &&
    !hasLogs &&
    !hasMetrics &&
    !props.overview.isTabLoading;

  const skeleton = (
    <Fragment>
      <TraceBreadcrumbs organization={props.organization} traceSlug={props.traceSlug} />
      <TopBar.Slot name="feedback" feedbackOptions={traceViewFeedbackOptions} />
      <EntityHeader
        isLoading
        title={{type: 'text', label: t('Trace'), value: t('Trace')}}
        stats={{
          label: STATS_LABEL,
          items: [
            {label: t('Root Duration'), value: null},
            {label: t('Spans'), value: null},
            {label: t('Issues'), value: null},
          ],
        }}
        metadata={{label: METADATA_LABEL, items: [null, null, null, null]}}
      />
    </Fragment>
  );

  if (isLoading) {
    return skeleton;
  }

  // The waterfall below explains a failed or empty trace, so the header only
  // names the page.
  if (isTreeError || noEvents) {
    return (
      <Fragment>
        <TraceBreadcrumbs organization={props.organization} traceSlug={props.traceSlug} />
        <TopBar.Slot name="feedback" feedbackOptions={traceViewFeedbackOptions} />
        <EntityHeader title={{type: 'text', label: t('Trace'), value: t('Trace')}} />
      </Fragment>
    );
  }

  const rep = props.tree.findRepresentativeTraceNode({
    logs: props.overview.logs.representative,
  });
  const project = projects.find(p => {
    const id =
      rep?.event && OurLogKnownFieldKey.PROJECT_ID in rep.event
        ? rep.event[OurLogKnownFieldKey.PROJECT_ID]
        : rep?.event?.projectId;
    return p.id === String(id);
  });
  const overviewProjectSlugs = (props.overview.projectIds ?? [])
    .map(projectId => projects.find(p => p.id === projectId)?.slug)
    .filter(defined);
  const traceProjects: AvatarProject[] = Array.from(
    new Set([
      ...Array.from(props.tree.projects.values()).map(p => p.slug),
      ...overviewProjectSlugs,
      ...(project ? [project.slug] : []),
    ])
  ).map(slug => projects.find(p => p.slug === slug) ?? {slug});

  const projectsGraphic: EntityHeaderLeadingGraphic | undefined =
    traceProjects.length > 0
      ? {
          type: 'project',
          projects: traceProjects,
          label: t('Projects: %s', traceProjects.map(p => p.slug).join(', ')),
        }
      : undefined;

  const traceNode = props.tree.root.children[0];
  // Without trace data, the timestamp from the query params approximates when
  // the trace started.
  const startTimestamp =
    traceNode?.space[0] ?? (timestamp ? timestamp * 1000 : undefined);
  const traceTitle = getTraceTitle(rep);
  const metadataItems = getTraceMetadataItems({
    operation: traceTitle.operation,
    organization: props.organization,
    project,
    properties: getTraceProperties(props.rootEventResults.data, rep?.dataset ?? null),
    replayId: getReplayId(props.rootEventResults.data),
    startTimestamp,
  });

  // Until the root event lands, a row with nothing from the tree to show would
  // disappear and come back, so the header holds its skeleton instead.
  if (props.rootEventResults.isLoading && metadataItems.every(item => item === null)) {
    return skeleton;
  }

  return (
    <Fragment>
      <TraceBreadcrumbs
        organization={props.organization}
        traceSlug={props.traceSlug}
        project={project}
        rootEventResults={props.rootEventResults}
      />
      <TopBar.Slot name="feedback" feedbackOptions={traceViewFeedbackOptions} />
      <EntityHeader
        title={{
          type: 'text',
          label: t('Trace'),
          value: traceTitle.title,
          leadingGraphic: projectsGraphic,
        }}
        stats={{
          label: STATS_LABEL,
          items: getTraceStatItems({
            logsEnabled,
            meta: props.metaResults.data,
            metricsEnabled,
            organization: props.organization,
            overview: props.overview,
            representativeEvent: rep,
            traceSlug: props.traceSlug,
            tree: props.tree,
          }),
        }}
        metadata={{label: METADATA_LABEL, items: metadataItems}}
      />
    </Fragment>
  );
}
