import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceContextProfiles} from 'sentry/views/performance/newTraceDetails/traceContextProfiles';
import {TraceContextTags} from 'sentry/views/performance/newTraceDetails/traceContextTags';
import {TraceContextVitals} from 'sentry/views/performance/newTraceDetails/traceContextVitals';
import {TraceContextSectionKeys} from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';
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
  scrollContainer: React.RefObject<HTMLDivElement | null>;
  traceSlug: string;
  tree: TraceTree;
};

export function TraceContextPanel({
  traceSlug,
  tree,
  rootEventResults,
  onScrollToNode,
  logs,
  scrollContainer,
}: Props) {
  const {hasProfiles, hasLogs, hasTags} = useTraceContextSections({
    tree,
    rootEventResults,
    logs,
  });

  return (
    <Container>
      <TraceContextVitals
        rootEventResults={rootEventResults}
        tree={tree}
        containerWidth={undefined}
      />
      {hasTags && rootEventResults.data && (
        <ContextRow>
          <FoldSection
            sectionKey={TraceContextSectionKeys.TAGS as string as SectionKey}
            title={t('Tags')}
            disableCollapsePersistence
          >
            <TraceContextTags rootEventResults={rootEventResults} />
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
            <TraceViewLogsSection scrollContainer={scrollContainer} />
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
  gap: ${space(2)};
`;

const ContextRow = styled('div')`
  background-color: ${p => p.theme.background};
  width: 100%;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};
`;
