import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import StructuredEventData from 'sentry/components/structuredEventData';
import type {OnExpandCallback} from 'sentry/views/replays/detail/useVirtualizedInspector';

interface Props {
  description: ReactNode;
  onInspectorExpanded: OnExpandCallback;
  expandPaths?: string[];
}

export function BreadcrumbStructuredData({
  description,
  expandPaths,
  onInspectorExpanded,
}: Props) {
  return (
    <NoMarginWrapper>
      <StructuredEventData
        initialExpandedPaths={expandPaths ?? []}
        onToggleExpand={(expandedPaths, path) => {
          onInspectorExpanded(
            path,
            Object.fromEntries(expandedPaths.map(item => [item, true]))
          );
        }}
        data={description}
        withAnnotatedText
      />
    </NoMarginWrapper>
  );
}

const NoMarginWrapper = styled('div')`
  pre {
    margin: 0;
  }
`;
