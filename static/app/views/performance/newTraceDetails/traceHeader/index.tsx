import {Container} from '@sentry/scraps/layout';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {useProjects} from 'sentry/utils/useProjects';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
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
import {useTraceContextSections} from 'sentry/views/performance/newTraceDetails/useTraceContextSections';

import {getTraceViewBreadcrumbs} from './breadcrumbs';
import {Meta} from './meta';
import {Title} from './title';

export interface TraceMetadataHeaderProps {
  logs: OurLogsResponseItem[] | undefined;
  metaResults: TraceMetaQueryResults;
  metrics: {count: number} | undefined;
  organization: Organization;
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
  const {hasLogs, hasMetrics} = useTraceContextSections({
    tree: props.tree,
    logs: props.logs,
    metrics: props.metrics,
    meta: props.metaResults.data,
    logsEnabled,
    metricsEnabled,
  });

  const isLoading =
    props.metaResults.status === 'pending' ||
    props.rootEventResults.isLoading ||
    props.tree.type === 'loading';

  const isError =
    props.metaResults.status === 'error' ||
    props.rootEventResults.status === 'error' ||
    props.tree.type === 'error';

  const noEvents = props.tree.type === 'empty' && !hasLogs && !hasMetrics;
  if (isLoading || isError || noEvents) {
    return <PlaceHolder organization={props.organization} traceSlug={props.traceSlug} />;
  }

  const rep = props.tree.findRepresentativeTraceNode({logs: props.logs});
  const project = projects.find(p => {
    const id =
      rep?.event && OurLogKnownFieldKey.PROJECT_ID in rep.event
        ? rep.event[OurLogKnownFieldKey.PROJECT_ID]
        : rep?.event?.projectId;
    return p.id === String(id);
  });

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

        <TraceHeaderComponents.HeaderGrid>
          <Container area="title" minWidth={0}>
            <Title representativeEvent={rep} rootEventResults={props.rootEventResults} />
          </Container>
          <Container area="meta" justifySelf={{zero: 'start', xl: 'end'}}>
            <Meta
              tree={props.tree}
              meta={props.metaResults.data}
              representativeEvent={rep}
              logs={props.logs}
              metrics={props.metrics}
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
            <Projects projects={projects} logs={props.logs} tree={props.tree} />
          </Container>
        </TraceHeaderComponents.HeaderGrid>
      </TraceHeaderComponents.HeaderContent>
    </TraceHeaderComponents.HeaderLayout>
  );
}
