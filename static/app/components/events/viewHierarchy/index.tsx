import {Fragment} from 'react';

import {RenderingSystem} from './renderingSystem';
import {ViewHierarchyTree} from './tree';

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
  selectedWindow: number;
  viewHierarchy: ViewHierarchyData;
};

function ViewHierarchy({viewHierarchy, selectedWindow}: ViewHierarchyProps) {
  return (
    <Fragment>
      <RenderingSystem system={viewHierarchy.rendering_system} />
      <ViewHierarchyTree hierarchy={viewHierarchy.windows[selectedWindow]} />
    </Fragment>
  );
}

export {ViewHierarchy};
