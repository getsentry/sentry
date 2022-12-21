import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {IconAdd, IconSubtract} from 'sentry/icons';
import space from 'sentry/styles/space';

type NodeProps = {
  type: string;
  children?: ReactNode[];
};

function Node({type, children}: NodeProps) {
  return (
    <NodeContents>
      <div>
        {children?.length && <IconAdd size="xs" />}
        {type}
      </div>
      {children}
    </NodeContents>
  );
}

function Tree({hierarchy}) {
  if (!hierarchy.children.length) {
    return <Node type={hierarchy.type} />;
  }

  return (
    <Node type={hierarchy.type}>
      {hierarchy.children.map(element => (
        <Tree key={element.type} hierarchy={element} />
      ))}
    </Node>
  );
}

function ViewHierarchyContainer({hierarchy}) {
  return (
    <div style={{maxHeight: '500px', overflow: 'auto'}}>
      {/* <pre>{JSON.stringify(hierarchy, null, 2)}</pre> */}
      <Tree hierarchy={hierarchy} />
    </div>
  );
}

export {ViewHierarchyContainer as ViewHierarchyTree};

const NodeContents = styled('div')`
  margin-left: ${space(1.5)};
  border-left: 1px solid black;
  padding-left: ${space(1.5)};
`;

// const IconContainer = styled('div')`
//   display: inline-block;
//   margin-left: ${space(1)};
//   border: 1px solid black;
//   height: 12px;
//   width: 12px;
// `;
