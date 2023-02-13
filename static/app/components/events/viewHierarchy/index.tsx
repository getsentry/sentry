import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {Node} from 'sentry/components/events/viewHierarchy/node';
import {Wireframe} from 'sentry/components/events/viewHierarchy/wireframe';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {
  useVirtualizedTree,
  UseVirtualizedTreeProps,
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
  project: Project;
  viewHierarchy: ViewHierarchyData;
};

function ViewHierarchy({viewHierarchy, project}: ViewHierarchyProps) {
  const [scrollContainerRef, setScrollContainerRef] = useState<HTMLDivElement | null>(
    null
  );
  const [selectedNode, setSelectedNode] = useState<ViewHierarchyWindow | undefined>(
    viewHierarchy.windows[0]
  );
  const [userHasSelected, setUserHasSelected] = useState(false);
  const hierarchy = useMemo(() => {
    return viewHierarchy.windows;
  }, [viewHierarchy.windows]);

  const renderRow: UseVirtualizedTreeProps<ViewHierarchyWindow>['renderRow'] = (
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
        onClick={e => {
          handleRowClick(e);
          setSelectedNode(r.item.node);
          setUserHasSelected(true);
        }}
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
    handleScrollTo,
  } = useVirtualizedTree({
    renderRow,
    rowHeight: 20,
    scrollContainer: scrollContainerRef,
    tree: hierarchy,
    expanded: true,
    overscroll: 10,
    initialSelectedNodeIndex: 0,
  });

  // Scroll to the selected node when it changes
  const onWireframeNodeSelect = useCallback(
    (node?: ViewHierarchyWindow) => {
      setUserHasSelected(true);
      setSelectedNode(node);
      handleScrollTo(item => item === node);
    },
    [handleScrollTo]
  );

  const showWireframe = project?.platform !== 'unity';

  if (!hierarchy.length) {
    return (
      <EmptyStateContainer>
        <EmptyStateWarning small>
          {t('There is no view hierarchy data to visualize')}
        </EmptyStateWarning>
      </EmptyStateContainer>
    );
  }

  return (
    <Fragment>
      <RenderingSystem system={viewHierarchy.rendering_system} />
      <Content>
        <Left hasRight={showWireframe}>
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
        {showWireframe && (
          <Right>
            <Wireframe
              hierarchy={hierarchy}
              selectedNode={userHasSelected ? selectedNode : undefined}
              onNodeSelect={onWireframeNodeSelect}
            />
          </Right>
        )}
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

const Left = styled('div')<{hasRight?: boolean}>`
  width: ${p => (p.hasRight ? '40%' : '100%')};
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
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

const EmptyStateContainer = styled('div')`
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
`;
