import {ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type NodeProps = {
  type: string;
  children?: ReactNode[];
};

function Node({type, children}: NodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <NodeContents>
      <div>
        {children?.length && (
          <IconWrapper
            aria-label={isExpanded ? t('Collapse') : t('Expand')}
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
        {type}
      </div>
      {isExpanded && children}
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
  margin-left: ${space(0.5)};
  border-left: 1px solid ${p => p.theme.gray200};
  padding-left: ${space(1.5)};

  :first-child {
    margin-left: 0;
    border-left: none;
    padding-left: 0;
  }
`;

const IconWrapper = styled('div')<{isExpanded: boolean}>`
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
