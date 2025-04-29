import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
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
import {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {getRepresentativeTraceEvent} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import Highlights from 'sentry/views/performance/newTraceDetails/traceHeader/highlights';
import {PlaceHolder} from 'sentry/views/performance/newTraceDetails/traceHeader/placeholder';
import Projects from 'sentry/views/performance/newTraceDetails/traceHeader/projects';
import ScrollToSectionLinks from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';
import {TraceHeaderComponents} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {getTraceViewBreadcrumbs} from './breadcrumbs';
import {Meta} from './meta';
import {Title} from './title';

export interface TraceMetadataHeaderProps {
  logs: OurLogsResponseItem[];
  metaResults: TraceMetaQueryResults;
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

  const isLoading =
    props.metaResults.status === 'pending' ||
    props.rootEventResults.isLoading ||
    props.tree.type === 'loading';

  const isError =
    props.metaResults.status === 'error' ||
    props.rootEventResults.status === 'error' ||
    props.tree.type === 'error';

  if (isLoading || isError) {
    return <PlaceHolder organization={props.organization} traceSlug={props.traceSlug} />;
  }

  const representativeEvent = getRepresentativeTraceEvent(props.tree, props.logs);
  const project = representativeEvent
    ? OurLogKnownFieldKey.PROJECT_ID in representativeEvent
      ? projects.find(p => {
          return p.id === representativeEvent[OurLogKnownFieldKey.PROJECT_ID];
        })
      : projects.find(p => p.slug === representativeEvent?.event?.project_slug)
    : undefined;

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
          <ButtonBar gap={1}>
            <TraceHeaderComponents.ToggleTraceFormatButton
              location={location}
              organization={props.organization}
            />
            <TraceHeaderComponents.FeedbackButton />
          </ButtonBar>
        </TraceHeaderComponents.HeaderRow>
        <TraceHeaderComponents.HeaderRow>
          <Title
            representativeEvent={representativeEvent}
            rootEventResults={props.rootEventResults}
          />
          <Meta
            organization={props.organization}
            tree={props.tree}
            meta={props.metaResults.data}
            representativeEvent={representativeEvent}
            logs={props.logs}
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
            <ScrollToSectionLinks
              rootEventResults={props.rootEventResults}
              tree={props.tree}
              logs={props.logs}
            />
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
