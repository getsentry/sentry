import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import EventTagsTree from 'sentry/components/events/eventTags/eventTagsTree';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {TraceContextProfiles} from 'sentry/views/performance/newTraceDetails/traceContextProfiles';
import {TraceContextVitals} from 'sentry/views/performance/newTraceDetails/traceContextVitals';
import {TraceContextSectionKeys} from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';
import {TraceLinkNavigationButton} from 'sentry/views/performance/newTraceDetails/traceLinksNavigation/traceLinkNavigationButton';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {TraceViewLogsSection} from 'sentry/views/performance/newTraceDetails/traceOurlogs';
import {TraceSummarySection} from 'sentry/views/performance/newTraceDetails/traceSummary';
import {useTraceContextSections} from 'sentry/views/performance/newTraceDetails/useTraceContextSections';

import type {TraceRootEventQueryResults} from './traceApi/useTraceRootEvent';

type Props = {
  logs: OurLogsResponseItem[] | undefined;
  onScrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  rootEventResults: TraceRootEventQueryResults;
  traceSlug: string;
  tree: TraceTree;
};

export function TraceContextPanel({
  traceSlug,
  tree,
  rootEventResults,
  onScrollToNode,
  logs,
}: Props) {
  const {hasProfiles, hasLogs, hasTags} = useTraceContextSections({
    tree,
    rootEventResults,
    logs,
  });
  const location = useLocation();
  const theme = useTheme();
  const organization = useOrganization();
  const showLinkedTraces = organization?.features.includes('trace-view-linked-traces');

  return (
    <Container>
      {showLinkedTraces && !isTraceItemDetailsResponse(rootEventResults.data) && (
        <TraceLinksNavigationContainer>
          <TraceLinkNavigationButton
            direction={'previous'}
            isLoading={rootEventResults.isLoading}
            traceContext={rootEventResults.data?.contexts.trace}
            currentTraceTimestamps={{
              start: rootEventResults.data?.startTimestamp,
              end: rootEventResults.data?.endTimestamp,
            }}
          />
          <TraceLinkNavigationButton
            direction={'next'}
            isLoading={rootEventResults.isLoading}
            projectID={rootEventResults.data?.projectID ?? ''}
            traceContext={rootEventResults.data?.contexts.trace}
            currentTraceTimestamps={{
              start: rootEventResults.data?.startTimestamp,
              end: rootEventResults.data?.endTimestamp,
            }}
          />
        </TraceLinksNavigationContainer>
      )}

      <VitalMetersContainer id={TraceContextSectionKeys.WEB_VITALS}>
        <TraceContextVitals rootEventResults={rootEventResults} tree={tree} logs={logs} />
      </VitalMetersContainer>
      {hasTags && rootEventResults.data && (
        <ContextRow>
          <FoldSection
            sectionKey={TraceContextSectionKeys.TAGS as string as SectionKey}
            title={t('Tags')}
            disableCollapsePersistence
          >
            {isTraceItemDetailsResponse(rootEventResults.data) ? (
              <AttributesTree
                attributes={rootEventResults.data.attributes}
                rendererExtra={{
                  theme,
                  location,
                  organization,
                }}
              />
            ) : (
              <EventTagsTree
                event={rootEventResults.data}
                meta={rootEventResults.data._meta}
                projectSlug={rootEventResults.data.projectSlug ?? ''}
                tags={rootEventResults.data.tags}
              />
            )}
          </FoldSection>
        </ContextRow>
      )}
      {hasProfiles && (
        <ContextRow>
          <TraceContextProfiles tree={tree} onScrollToNode={onScrollToNode} />
        </ContextRow>
      )}
      <Feature features={['ourlogs-enabled']}>
        {hasLogs && (
          <ContextRow>
            <TraceViewLogsSection />
          </ContextRow>
        )}
      </Feature>
      <Feature features={['single-trace-summary']}>
        <ContextRow>
          <TraceSummarySection traceSlug={traceSlug} />
        </ContextRow>
      </Feature>
    </Container>
  );
}

const Container = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${space(1)};
`;

const VitalMetersContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(1)};
  width: 100%;
`;

const ContextRow = styled('div')`
  background-color: ${p => p.theme.background};
  width: 100%;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};
`;

const TraceLinksNavigationContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  flex-direction: row;

  &:not(:empty) {
    margin-top: ${space(1)};
  }
`;
