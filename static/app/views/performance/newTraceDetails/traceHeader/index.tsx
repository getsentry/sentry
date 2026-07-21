import {Flex} from '@sentry/scraps/layout';

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
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {Highlights} from 'sentry/views/performance/newTraceDetails/traceHeader/highlights';
import {PlaceHolder} from 'sentry/views/performance/newTraceDetails/traceHeader/placeholder';
import {Projects} from 'sentry/views/performance/newTraceDetails/traceHeader/projects';
import {TraceHeaderComponents} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceOverviewData} from 'sentry/views/performance/newTraceDetails/useTraceOverviewData';

import {getTraceViewBreadcrumbs} from './breadcrumbs';
import {Meta} from './meta';
import {Title} from './title';

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

  if (props.metaResults.status === 'pending' || props.tree.type === 'loading') {
    return <PlaceHolder organization={props.organization} traceSlug={props.traceSlug} />;
  }

  const isRepresentativeLoading = props.overview.isRepresentativeLoading;
  const isProjectsLoading = props.overview.isProjectsLoading;
  const representativeLogs = props.overview.logs.representative
    ? [props.overview.logs.representative]
    : undefined;
  const rep = props.tree.findRepresentativeTraceNode({logs: representativeLogs});
  const project = projects.find(p => {
    const id =
      rep?.event && OurLogKnownFieldKey.PROJECT_ID in rep.event
        ? rep.event[OurLogKnownFieldKey.PROJECT_ID]
        : rep?.event?.projectId;
    return p.id === String(id);
  });
  const overviewProjectSlugs = props.overview.projectIds
    .map(projectId => projects.find(p => p.id === projectId)?.slug)
    .filter(defined);

  return (
    <TraceHeaderComponents.HeaderLayout>
      <TraceHeaderComponents.HeaderContent gap="xs">
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
        <TopBar.Slot name="feedback">
          <FeedbackButton
            feedbackOptions={traceViewFeedbackOptions}
            aria-label={t('Give Feedback')}
            tooltipProps={{title: t('Give Feedback')}}
          >
            {null}
          </FeedbackButton>
        </TopBar.Slot>

        <TraceHeaderComponents.HeaderRow>
          <Title
            isLoading={isRepresentativeLoading}
            representativeEvent={rep}
            rootEventResults={props.rootEventResults}
          />
          <Meta
            tree={props.tree}
            meta={props.metaResults.data}
            overview={props.overview}
            representativeEvent={rep}
            logsEnabled={logsEnabled}
            metricsEnabled={metricsEnabled}
          />
        </TraceHeaderComponents.HeaderRow>
        <TraceHeaderComponents.HeaderRow>
          <Highlights
            rootEventResults={props.rootEventResults}
            project={project}
            organization={props.organization}
          />
          <Flex align="center" gap="md" marginLeft="auto">
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
          </Flex>
        </TraceHeaderComponents.HeaderRow>
      </TraceHeaderComponents.HeaderContent>
    </TraceHeaderComponents.HeaderLayout>
  );
}
