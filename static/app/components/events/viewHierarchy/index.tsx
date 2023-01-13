import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';

import {DetailsPanel} from './detailsPanel';
import {RenderingSystem} from './renderingSystem';
import {Tree} from './tree';

function getNodeLabel({identifier, type}: ViewHierarchyWindow) {
  return identifier ? `${type} - ${identifier}` : type;
}

export type ViewHierarchyWindow = {
  alpha: number;
  height: number;
  id: string;
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
  const [selectedWindow] = useState(0);
  const [selectedNode, setSelectedNode] = useState<null | ViewHierarchyWindow>(null);
  return (
    <Fragment>
      <RenderingSystem system={viewHierarchy.rendering_system} />
      <TreeContainer>
        <Tree<ViewHierarchyWindow>
          data={viewHierarchy.windows[selectedWindow]}
          getNodeLabel={getNodeLabel}
          onNodeSelection={data => {
            if (data !== selectedNode) {
              setSelectedNode(data);
            } else {
              setSelectedNode(null);
            }
          }}
          isRoot
          selectedNodeId={selectedNode?.id ?? ''}
        />
      </TreeContainer>
      {defined(selectedNode) && (
        <DetailsPanel data={selectedNode} getTitle={getNodeLabel} />
      )}
    </Fragment>
  );
}

export {ViewHierarchy};

const TreeContainer = styled('div')`
  max-height: 500px;
  overflow: auto;
  background-color: ${p => p.theme.surface100};
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)} 0;
  display: block;
`;
