import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Node} from 'sentry/components/events/viewHierarchy/node';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {
  UseVirtualizedListProps,
  useVirtualizedTree,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';

import {DetailsPanel} from './detailsPanel';
import {RenderingSystem} from './renderingSystem';

function getNodeLabel({identifier, type}: ViewHierarchyWindow) {
  return identifier ? `${type} - ${identifier}` : type;
}

export type ViewHierarchyWindow = {
  alpha: number;
  depth: number;
  height: number;
  id: string;
  type: string;
  visible: boolean;
  width: number;
  x: number;
  y: number;
  children?: ViewHierarchyWindow[];
  identifier?: string;
};

export type ViewHierarchyData = {
  rendering_system: string;
  windows: ViewHierarchyWindow[];
};

type ViewHierarchyProps = {
  viewHierarchy: ViewHierarchyData;
};

function ViewHierarchy({viewHierarchy}: ViewHierarchyProps) {
  const [scrollContainerRef, setScrollContainerRef] = useState<HTMLDivElement | null>(
    null
  );
  const [selectedWindow] = useState(0);
  const [selectedNode, setSelectedNode] = useState<ViewHierarchyWindow | null>(null);
  const hierarchy = useMemo(() => {
    return [viewHierarchy.windows[selectedWindow]];
  }, [selectedWindow, viewHierarchy.windows]);

  const renderRow: UseVirtualizedListProps<ViewHierarchyWindow>['renderRow'] = (
    r,
    {handleExpandTreeNode}
  ) => {
    return (
      <TreeItem
        key={`view-hierarchy-node-${r.key}`}
        ref={n => {
          r.ref = n;
        }}
        style={r.styles}
        depth={r.item.depth}
      >
        <Node
          id={`view-hierarchy-node-${r.key}`}
          label={getNodeLabel(r.item.node)}
          onExpandClick={() => handleExpandTreeNode(r.item, {expandChildren: false})}
          collapsible={!!r.item.node.children?.length}
          isExpanded={r.item.expanded}
          onSelection={() => {
            if (r.item.node !== selectedNode) {
              setSelectedNode(r.item.node);
            } else {
              setSelectedNode(null);
            }
          }}
          isSelected={selectedNode === r.item.node}
        />
      </TreeItem>
    );
  };

  const {renderedItems, containerStyles, scrollContainerStyles} = useVirtualizedTree({
    renderRow,
    rowHeight: 20,
    scrollContainer: scrollContainerRef,
    tree: hierarchy,
    expanded: true,
    overscroll: 10,
  });
  return (
    <Fragment>
      <RenderingSystem system={viewHierarchy.rendering_system} />
      <TreeContainer>
        <ScrollContainer ref={setScrollContainerRef} style={scrollContainerStyles}>
          <RenderedItemsContainer style={containerStyles}>
            {renderedItems}
          </RenderedItemsContainer>
        </ScrollContainer>
      </TreeContainer>
      {defined(selectedNode) && (
        <DetailsPanel data={selectedNode} getTitle={getNodeLabel} />
      )}
    </Fragment>
  );
}

export {ViewHierarchy};

const TreeContainer = styled('div')`
  position: relative;
  height: 400px;
  overflow: hidden;
  overflow-y: auto;
  background-color: ${p => p.theme.surface100};
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
`;

const ScrollContainer = styled('div')`
  padding: ${space(1.5)};
`;

const RenderedItemsContainer = styled('div')`
  position: relative;
`;

const TreeItem = styled('div')<{depth: number}>`
  padding-left: ${p => p.depth * 16}px;
  height: 20px;
`;
