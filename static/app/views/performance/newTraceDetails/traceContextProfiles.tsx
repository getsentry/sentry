import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceProfiles} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceProfiles';
import {TraceContextSectionKeys} from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {EmptyStateText} from 'sentry/views/traces/styles';

export function TraceContextProfiles({
  tree,
  onScrollToNode,
}: {
  onScrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  tree: TraceTree;
}) {
  const hasProfiles = tree.profiled_events.size > 0;

  return (
    <FoldSection
      sectionKey={TraceContextSectionKeys.PROFILES as string as SectionKey}
      title={t('Profiles')}
    >
      {tree.type === 'loading' ? (
        <LoadingIndicator />
      ) : tree.type === 'trace' && hasProfiles ? (
        <TraceProfiles tree={tree} onScrollToNode={onScrollToNode} />
      ) : (
        <EmptyStateWarning withIcon>
          <EmptyStateText size="fontSizeExtraLarge">
            {t('No profiles found')}
          </EmptyStateText>
        </EmptyStateWarning>
      )}
    </FoldSection>
  );
}
