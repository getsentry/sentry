import {useCallback} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import Highlights from 'sentry/views/performance/newTraceDetails/traceHeader/highlights';
import {PlaceHolder} from 'sentry/views/performance/newTraceDetails/traceHeader/placeholder';
import Projects from 'sentry/views/performance/newTraceDetails/traceHeader/projects';
import ScrollToSectionLinks from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';
import {TraceHeaderComponents} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';

import {isRootEvent} from '../../traceDetails/utils';
import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import TraceConfigurations from '../traceConfigurations';
import {isEAPTraceNode, isTraceNode} from '../traceGuards';
import type {TraceTree} from '../traceModels/traceTree';
import {useHasTraceNewUi} from '../useHasTraceNewUi';

import {getTraceViewBreadcrumbs} from './breadcrumbs';
import {Meta} from './meta';
import {Title} from './title';

export interface TraceMetadataHeaderProps {
  logs: OurLogsResponseItem[];
  metaResults: TraceMetaQueryResults;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceEventView: EventView;
  traceSlug: string;
  tree: TraceTree;
  project?: Project;
}

const CANDIDATE_TRACE_TITLE_OPS = ['pageload', 'navigation'];

const getRepresentativeEvent = (
  tree: TraceTree,
  logs: OurLogsResponseItem[]
): TraceTree.TraceEvent | OurLogsResponseItem | null => {
  if (tree.type === 'empty' && logs.length > 0) {
    return logs[0] ?? null;
  }

  const traceNode = tree.root.children[0];

  if (!traceNode) {
    return null;
  }

  if (!isTraceNode(traceNode) && !isEAPTraceNode(traceNode)) {
    throw new TypeError('Not trace node');
  }

  let firstRootEvent: TraceTree.TraceEvent | null = null;
  let candidateEvent: TraceTree.TraceEvent | null = null;
  let firstEvent: TraceTree.TraceEvent | null = null;

  const events = isTraceNode(traceNode)
    ? [...traceNode.value.transactions, ...traceNode.value.orphan_errors]
    : traceNode.value;
  for (const event of events) {
    // If we find a root transaction, we can stop looking and use it for the title.
    if (!firstRootEvent && isRootEvent(event)) {
      firstRootEvent = event;
      break;
    } else if (
      // If we haven't found a root transaction, but we found a candidate transaction
      // with an op that we care about, we can use it for the title. We keep looking for
      // a root.
      !candidateEvent &&
      CANDIDATE_TRACE_TITLE_OPS.includes(
        'transaction.op' in event
          ? event['transaction.op']
          : 'op' in event
            ? event.op
            : ''
      )
    ) {
      candidateEvent = event;
      continue;
    } else if (!firstEvent) {
      // If we haven't found a root or candidate transaction, we can use the first transaction
      // in the trace for the title.
      firstEvent = event;
    }
  }

  return firstRootEvent ?? candidateEvent ?? firstEvent;
};

function LegacyTraceMetadataHeader(props: TraceMetadataHeaderProps) {
  const location = useLocation();
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);

  const trackOpenInDiscover = useCallback(() => {
    trackAnalytics('performance_views.trace_view.open_in_discover', {
      organization: props.organization,
    });
  }, [props.organization]);

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs
          crumbs={getTraceViewBreadcrumbs({
            organization: props.organization,
            location,
            moduleURLBuilder,
            traceSlug: props.traceSlug,
            project: props.project,
            view,
          })}
        />
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <TraceConfigurations rootEventResults={props.rootEventResults} />
          <DiscoverButton
            size="sm"
            to={props.traceEventView.getResultsViewUrlTarget(
              props.organization,
              false,
              hasDatasetSelector(props.organization)
                ? SavedQueryDatasets.TRANSACTIONS
                : undefined
            )}
            onClick={trackOpenInDiscover}
          >
            {t('Open in Discover')}
          </DiscoverButton>

          <FeedbackWidgetButton />
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

export function TraceMetaDataHeader(props: TraceMetadataHeaderProps) {
  const location = useLocation();
  const hasNewTraceViewUi = useHasTraceNewUi();
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);
  const {projects} = useProjects();

  if (!hasNewTraceViewUi) {
    return <LegacyTraceMetadataHeader {...props} />;
  }

  const isLoading =
    props.metaResults.status === 'pending' ||
    props.rootEventResults.isLoading ||
    props.tree.type === 'loading';

  const isError =
    props.metaResults.status === 'error' ||
    props.rootEventResults.status === 'error' ||
    props.tree.type === 'error';

  if (isLoading || isError) {
    return (
      <PlaceHolder
        organization={props.organization}
        project={undefined}
        traceSlug={props.traceSlug}
      />
    );
  }

  const representativeEvent = getRepresentativeEvent(props.tree, props.logs);
  const project = representativeEvent
    ? projects.find(p => {
        if (OurLogKnownFieldKey.PROJECT_ID in representativeEvent) {
          return (
            Number(p.id) === Number(representativeEvent[OurLogKnownFieldKey.PROJECT_ID])
          );
        }
        return p.slug === representativeEvent.project_slug;
      })
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
            rootEventResults={props.rootEventResults}
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
            tree={props.tree}
            logs={props.logs}
            project={project}
            organization={props.organization}
          />
          <Flex>
            <ScrollToSectionLinks tree={props.tree} />
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
