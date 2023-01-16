import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Node} from 'sentry/components/events/viewHierarchy/node';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useVirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';

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

  const {renderedItems, containerStyles, scrollContainerStyles} = useVirtualizedTree({
    renderRow: (r, {handleExpandTreeNode}) => {
      return (
        <div style={{...r.styles, paddingLeft: r.item.node.depth * 16, height: '20px'}}>
          <Node
            id={r.item.node.id}
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
            isSelected={selectedNode?.id === r.item.node.id}
          />
        </div>
      );
    },
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
        <div ref={setScrollContainerRef} style={scrollContainerStyles}>
          <div style={containerStyles}>{renderedItems}</div>
        </div>
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
  max-height: 500px;
  overflow: auto;
  background-color: ${p => p.theme.surface100};
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)} 0 ${space(1.5)} ${space(1.5)};
`;
