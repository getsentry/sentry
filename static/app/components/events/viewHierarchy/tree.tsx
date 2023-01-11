import {ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type NodeProps = {
  id: string;
  label: string;
  children?: ReactNode;
  collapsible?: boolean;
  isSelected?: boolean;
  onSelection?: () => void;
};

function Node({label, id, children, collapsible, onSelection, isSelected}: NodeProps) {
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
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <IconSubtract legacySize="9px" color="white" />
                ) : (
                  <IconAdd legacySize="9px" color="white" />
                )}
              </IconWrapper>
            )}
            <NodeTitle id={`${id}-title`} onClick={onSelection} selected={isSelected}>
              {label}
            </NodeTitle>
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
  onNodeSelection?: (data: TreeData<T>) => void;
  selectedNodeId?: string;
};

function Tree<T>({
  data,
  isRoot,
  getNodeLabel,
  onNodeSelection,
  selectedNodeId,
}: TreeProps<T>) {
  const {id, children} = data;
  const isNodeSelected = selectedNodeId === id;
  if (!children?.length) {
    return (
      <Node
        id={id}
        label={getNodeLabel(data)}
        onSelection={() => onNodeSelection?.(data)}
        isSelected={isNodeSelected}
      />
    );
  }

  const treeNode = (
    <Node
      id={id}
      label={getNodeLabel(data)}
      onSelection={() => onNodeSelection?.(data)}
      isSelected={isNodeSelected}
      collapsible
    >
      <ChildList>
        {children.map(element => (
          <Tree
            key={element.id}
            data={element}
            getNodeLabel={getNodeLabel}
            onNodeSelection={onNodeSelection}
            selectedNodeId={selectedNodeId}
          />
        ))}
      </ChildList>
    </Node>
  );

  return isRoot ? <RootList>{treeNode}</RootList> : treeNode;
}

export {Tree};

const RootList = styled('ul')`
  margin-bottom: 0;
`;

const ChildList = styled('ul')`
  border-left: 1px solid ${p => p.theme.gray200};
  margin-left: 5px;
`;

const NodeContents = styled('li')`
  padding-left: 0;
  display: block;
`;

const NodeTitle = styled('span')<{selected?: boolean}>`
  cursor: pointer;
  ${({selected, theme}) =>
    selected &&
    `
    background-color: ${theme.purple200};
    padding: 0 ${space(0.5)};
    border-radius: ${theme.borderRadius}
  `}
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
