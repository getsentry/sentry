import styled from '@emotion/styled';

import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';

type NodeProps = {
  id: string;
  isExpanded: boolean;
  label: string;
  onExpandClick: () => void;
  collapsible?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
};

function Node({
  label,
  id,
  isExpanded,
  isFocused,
  onExpandClick,
  collapsible = false,
}: NodeProps) {
  return (
    <NodeContents aria-labelledby={`${id}-title`}>
      <IconWrapper
        aria-controls={id}
        aria-label={isExpanded ? t('Collapse') : t('Expand')}
        aria-expanded={isExpanded}
        isExpanded={isExpanded}
        onClick={onExpandClick}
        collapsible={collapsible}
      >
        {isExpanded ? (
          <IconSubtract legacySize="9px" color="white" />
        ) : (
          <IconAdd legacySize="9px" color="white" />
        )}
      </IconWrapper>
      <NodeTitle id={`${id}-title`} focused={isFocused}>
        {label}
      </NodeTitle>
    </NodeContents>
  );
}

export {Node};

const NodeContents = styled('div')`
  padding-left: 0;
  display: block;
  white-space: nowrap;
`;

const NodeTitle = styled('span')<{focused?: boolean}>`
  cursor: pointer;
  ${({focused, theme}) =>
    focused &&
    `
    color: ${theme.white};
  `}
`;

const IconWrapper = styled('button')<{collapsible: boolean; isExpanded: boolean}>`
  padding: 0;
  border-radius: 2px;
  display: inline-flex;
  visibility: ${p => (p.collapsible ? 'visible' : 'hidden')};
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
