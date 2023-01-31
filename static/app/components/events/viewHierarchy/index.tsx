import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Node} from 'sentry/components/events/viewHierarchy/node';
import {Wireframe} from 'sentry/components/events/viewHierarchy/wireframe';
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
  height: number;
  type: string;
  visible: boolean;
  width: number;
  x: number;
  y: number;
  children?: ViewHierarchyWindow[];
  depth?: number;
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
  const [selectedNode, setSelectedNode] = useState<ViewHierarchyWindow | undefined>(
    viewHierarchy.windows[0]
  );
  const hierarchy = useMemo(() => {
    return viewHierarchy.windows;
  }, [viewHierarchy.windows]);

  const renderRow: UseVirtualizedListProps<ViewHierarchyWindow>['renderRow'] = (
    r,
    {
      handleExpandTreeNode,
      handleRowMouseEnter,
      handleRowClick,
      handleRowKeyDown,
      selectedNodeIndex,
    }
  ) => {
    const key = `view-hierarchy-node-${r.key}`;
    const depthMarkers = Array(r.item.depth)
      .fill('')
      .map((_, i) => <DepthMarker key={`${key}-depth-${i}`} />);
    return (
      <TreeItem
        key={key}
        ref={n => {
          r.ref = n;
        }}
        style={r.styles}
        tabIndex={selectedNodeIndex === r.key ? 0 : 1}
        onMouseEnter={handleRowMouseEnter}
        onKeyDown={handleRowKeyDown}
        onFocus={() => {
          setSelectedNode(r.item.node);
        }}
        onClick={handleRowClick}
      >
        {depthMarkers}
        <Node
          id={key}
          label={getNodeLabel(r.item.node)}
          onExpandClick={() => handleExpandTreeNode(r.item, {expandChildren: false})}
          collapsible={!!r.item.node.children?.length}
          isExpanded={r.item.expanded}
          isFocused={selectedNodeIndex === r.key}
        />
      </TreeItem>
    );
  };

  const {
    renderedItems,
    containerStyles,
    scrollContainerStyles,
    hoveredGhostRowRef,
    clickedGhostRowRef,
  } = useVirtualizedTree({
    renderRow,
    rowHeight: 20,
    scrollContainer: scrollContainerRef,
    tree: hierarchy,
    expanded: true,
    overscroll: 10,
    initialSelectedNodeIndex: 0,
  });

  return (
    <Fragment>
      <RenderingSystem system={viewHierarchy.rendering_system} />
      <Content>
        <Left>
          <TreeContainer>
            <GhostRow ref={hoveredGhostRowRef} />
            <GhostRow ref={clickedGhostRowRef} />
            <ScrollContainer ref={setScrollContainerRef} style={scrollContainerStyles}>
              <RenderedItemsContainer style={containerStyles}>
                {renderedItems}
              </RenderedItemsContainer>
            </ScrollContainer>
          </TreeContainer>
          {defined(selectedNode) && (
            <DetailsContainer>
              <DetailsPanel data={selectedNode} getTitle={getNodeLabel} />
            </DetailsContainer>
          )}
        </Left>
        <Right>
          <Wireframe hierarchy={hierarchy} />
        </Right>
      </Content>
    </Fragment>
  );
}

export {ViewHierarchy};

const Content = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  height: 700px;
`;

const Left = styled('div')`
  width: 40%;
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
  resize: both;
`;

const Right = styled('div')`
  width: 60%;
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const TreeContainer = styled('div')`
  position: relative;
  height: 70%;
  overflow: hidden;
  background-color: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
`;

const DetailsContainer = styled('div')`
  max-height: 30%;
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  overflow: auto;
`;

const ScrollContainer = styled('div')`
  padding: ${space(1.5)};
`;

const RenderedItemsContainer = styled('div')`
  position: relative;
`;

const TreeItem = styled('div')`
  display: flex;
  height: 20px;
  width: 100%;

  :focus {
    outline: none;
  }
`;

const DepthMarker = styled('div')`
  margin-left: 5px;
  min-width: ${space(2)};
  border-left: 1px solid ${p => p.theme.gray200};
`;

const GhostRow = styled('div')`
  top: ${space(1.5)};
`;
