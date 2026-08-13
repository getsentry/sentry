import {Container} from '@sentry/scraps/layout';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {useLocation} from 'sentry/utils/useLocation';
import {useProjects} from 'sentry/utils/useProjects';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasNewBreadcrumbs} from 'sentry/views/navigation/useHasNewBreadcrumbs';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {Highlights} from 'sentry/views/performance/newTraceDetails/traceHeader/highlights';
import {PlaceHolder} from 'sentry/views/performance/newTraceDetails/traceHeader/placeholder';
import {Projects} from 'sentry/views/performance/newTraceDetails/traceHeader/projects';
import {TraceHeaderComponents} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceContextSections} from 'sentry/views/performance/newTraceDetails/useTraceContextSections';
import type {TraceOverviewData} from 'sentry/views/performance/newTraceDetails/useTraceOverviewData';

import {getTraceViewBreadcrumbs} from './breadcrumbs';
import {Meta} from './meta';
import {Title} from './title';
import {TraceBreadcrumbs} from './traceBreadcrumbs';

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
  tags: {
    ['feedback.source']: 'trace-view',
    ['feedback.owner']: 'performance',
  },
};

export function TraceMetaDataHeader(props: TraceMetadataHeaderProps) {
  const location = useLocation();
  const logsEnabled = isLogsEnabled(props.organization);
  const metricsEnabled = canUseMetricsUI(props.organization);
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);
  const {projects} = useProjects();
  const hasNewBreadcrumbs = useHasNewBreadcrumbs();
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

  const isLoading =
    props.metaResults.status === 'pending' || props.tree.type === 'loading';

  const isError = props.metaResults.status === 'error' || props.tree.type === 'error';

  const isRepresentativeLoading = props.overview.isRepresentativeLoading;
  const noEvents =
    props.tree.type === 'empty' &&
    !hasLogs &&
    !hasMetrics &&
    !props.overview.isTabLoading &&
    !isRepresentativeLoading;
  if (isLoading || isError || noEvents) {
    return <PlaceHolder organization={props.organization} traceSlug={props.traceSlug} />;
  }

  const isProjectsLoading = props.overview.isProjectsLoading;
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

  return (
    <TraceHeaderComponents.HeaderLayout>
      <TraceHeaderComponents.HeaderContent gap="xs">
        {hasNewBreadcrumbs ? (
          <TraceBreadcrumbs
            organization={props.organization}
            traceSlug={props.traceSlug}
            project={project}
            rootEventResults={props.rootEventResults}
          />
        ) : (
          <TopBar.Slot name="title">
            <Breadcrumbs
              crumbs={getTraceViewBreadcrumbs({
                organization: props.organization,
                location,
                moduleURLBuilder,
                traceSlug: props.traceSlug,
                project,
                view,
              })}
            />
          </TopBar.Slot>
        )}
        <TopBar.Slot name="feedback">
          <FeedbackButton
            feedbackOptions={traceViewFeedbackOptions}
            aria-label={t('Give Feedback')}
            tooltipProps={{title: t('Give Feedback')}}
          >
            {null}
          </FeedbackButton>
        </TopBar.Slot>

        <TraceHeaderComponents.HeaderGrid>
          <Container area="title" minWidth={0}>
            <Title
              isLoading={isRepresentativeLoading}
              representativeEvent={rep}
              rootEventResults={props.rootEventResults}
            />
          </Container>
          <Container area="meta" justifySelf={{zero: 'start', xl: 'end'}}>
            <Meta
              tree={props.tree}
              meta={props.metaResults.data}
              overview={props.overview}
              representativeEvent={rep}
              logsEnabled={logsEnabled}
              metricsEnabled={metricsEnabled}
            />
          </Container>
          <Container area="highlights" minWidth={0}>
            <Highlights
              rootEventResults={props.rootEventResults}
              project={project}
              organization={props.organization}
            />
          </Container>
          <Container area="projects" justifySelf={{zero: 'start', xl: 'end'}}>
            {isProjectsLoading ? (
              <TraceHeaderComponents.StyledPlaceholder _width={50} _height={28} />
            ) : (
              <Projects
                projectSlugs={Array.from(
                  new Set([
                    ...Array.from(props.tree.projects.values()).map(p => p.slug),
                    ...overviewProjectSlugs,
                    ...(project ? [project.slug] : []),
                  ])
                )}
              />
            )}
          </Container>
        </TraceHeaderComponents.HeaderGrid>
      </TraceHeaderComponents.HeaderContent>
    </TraceHeaderComponents.HeaderLayout>
  );
}
