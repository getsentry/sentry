import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import Highlights from 'sentry/views/performance/newTraceDetails/traceHeader/highlights';
import {PlaceHolder} from 'sentry/views/performance/newTraceDetails/traceHeader/placeholder';
import Projects from 'sentry/views/performance/newTraceDetails/traceHeader/projects';
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
  traceEventView: EventView;
  traceSlug: string;
  tree: TraceTree;
  project?: Project;
}

export function TraceMetaDataHeader(props: TraceMetadataHeaderProps) {
  const location = useLocation();
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);
  const {projects} = useProjects();
  const {hasLogs, hasMetrics} = useTraceContextSections({
    tree: props.tree,
    logs: props.logs,
    metrics: props.metrics,
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
      <TraceHeaderComponents.HeaderContent>
        <TraceHeaderComponents.HeaderRow>
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
          <ButtonBar>
            <FeedbackButton
              size="xs"
              feedbackOptions={{
                messagePlaceholder: t('How can we make the trace view better for you?'),
                tags: {
                  ['feedback.source']: 'trace-view',
                  ['feedback.owner']: 'performance',
                },
              }}
            />
          </ButtonBar>
        </TraceHeaderComponents.HeaderRow>
        <TraceHeaderComponents.HeaderRow>
          <Title representativeEvent={rep} rootEventResults={props.rootEventResults} />
          <Meta
            organization={props.organization}
            tree={props.tree}
            meta={props.metaResults.data}
            representativeEvent={rep}
            logs={props.logs}
            metrics={props.metrics}
          />
        </TraceHeaderComponents.HeaderRow>
        <TraceHeaderComponents.StyledBreak />
        <TraceHeaderComponents.HeaderRow>
          <Highlights
            rootEventResults={props.rootEventResults}
            project={project}
            organization={props.organization}
          />
          <Flex>
            <Projects projects={projects} logs={props.logs} tree={props.tree} />
          </Flex>
        </TraceHeaderComponents.HeaderRow>
      </TraceHeaderComponents.HeaderContent>
    </TraceHeaderComponents.HeaderLayout>
  );
}

const Flex = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  align-items: center;
`;
