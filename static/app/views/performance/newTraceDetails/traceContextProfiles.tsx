import {t} from 'sentry/locale';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceProfiles} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceProfiles';
import {TraceContextSectionKeys} from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

export function TraceContextProfiles({
  tree,
  onScrollToNode,
}: {
  onScrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  tree: TraceTree;
}) {
  return (
    <FoldSection
      sectionKey={TraceContextSectionKeys.PROFILES as string as SectionKey}
      title={t('Profiles')}
      disableCollapsePersistence
    >
      <TraceProfiles tree={tree} onScrollToNode={onScrollToNode} />
    </FoldSection>
  );
}
