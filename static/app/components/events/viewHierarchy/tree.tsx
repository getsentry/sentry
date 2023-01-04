import {ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {ViewHierarchyWindow} from '.';

type NodeProps = {
  id: string;
  label: string;
  children?: ReactNode;
  collapsible?: boolean;
};

function Node({label, id, children, collapsible}: NodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <NodeContents aria-labelledby={`${id}-title`}>
      {
        <details id={id} open={isExpanded} onClick={e => e.preventDefault()}>
          <summary>
            {collapsible && (
              <IconWrapper
                aria-controls={id}
                aria-label={isExpanded ? t('Collapse') : t('Expand')}
                aria-expanded={isExpanded}
                isExpanded={isExpanded}
                onClick={evt => {
                  evt.preventDefault();
                  setIsExpanded(!isExpanded);
                }}
              >
                {isExpanded ? (
                  <IconSubtract size="9px" color="white" />
                ) : (
                  <IconAdd size="9px" color="white" />
                )}
              </IconWrapper>
            )}
            <NodeTitle id={`${id}-title`}>{label}</NodeTitle>
          </summary>
          {children}
        </details>
      }
    </NodeContents>
  );
}

type TreeData<T> = T & {id: string; children?: TreeData<T>[]};

type TreeProps<T> = {
  data: TreeData<T>;
  getNodeLabel: (data: TreeData<T>) => string;
  isRoot?: boolean;
};

function Tree<T>({data, isRoot, getNodeLabel}: TreeProps<T>) {
  const {id, children} = data;
  if (!children?.length) {
    return <Node label={getNodeLabel(data)} id={id} />;
  }

  const treeNode = (
    <Node label={getNodeLabel(data)} id={id} collapsible>
      <ChildList>
        {children.map(element => (
          <Tree key={element.id} data={element} getNodeLabel={getNodeLabel} />
        ))}
      </ChildList>
    </Node>
  );

  return isRoot ? <ul>{treeNode}</ul> : treeNode;
}

type ViewHierarchyContainerProps = {
  hierarchy: ViewHierarchyWindow;
};

function ViewHierarchyContainer({hierarchy}: ViewHierarchyContainerProps) {
  const getNodeLabel = ({identifier, type}: ViewHierarchyWindow) => {
    return identifier ? `${type} - ${identifier}` : type;
  };
  return (
    <Container>
      <Tree<ViewHierarchyWindow> data={hierarchy} getNodeLabel={getNodeLabel} isRoot />
    </Container>
  );
}

export {ViewHierarchyContainer as ViewHierarchyTree};

const ChildList = styled('ul')`
  border-left: 1px solid ${p => p.theme.gray200};
  margin-left: 5px;
`;

const NodeContents = styled('li')`
  padding-left: 0;
  display: block;
`;

const Container = styled('div')`
  max-height: 500px;
  overflow: auto;
  background-color: ${p => p.theme.surface100};
  border: 1px solid ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)} 0;
  display: block;

  ul {
    margin-bottom: 0;
  }
`;

// TODO(nar): Clicking the title will open more information
// about the node, currently this does nothing
const NodeTitle = styled('span')`
  cursor: pointer;
`;

const IconWrapper = styled('button')<{isExpanded: boolean}>`
  padding: 0;
  border-radius: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-right: 4px;
  ${p =>
    p.isExpanded
      ? `
          background: ${p.theme.gray300};
          border: 1px solid ${p.theme.gray300};
          &:hover {
            background: ${p.theme.gray400};
          }
        `
      : `
          background: ${p.theme.blue300};
          border: 1px solid ${p.theme.blue300};
          &:hover {
            background: ${p.theme.blue200};
          }
        `}
`;
