import {css} from '@emotion/react';
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

export function Node({
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
          <StyledIconSubtract legacySize="9px" />
        ) : (
          <StyledIconAdd legacySize="9px" />
        )}
      </IconWrapper>
      <NodeTitle id={`${id}-title`} focused={isFocused}>
        {label}
      </NodeTitle>
    </NodeContents>
  );
}

const StyledIconSubtract = styled(IconSubtract)`
  color: ${p => p.theme.colors.white};
`;
const StyledIconAdd = styled(IconAdd)`
  color: ${p => p.theme.colors.white};
`;

const NodeContents = styled('div')`
  padding-left: 0;
  display: block;
  white-space: nowrap;
`;

const NodeTitle = styled('span')<{focused?: boolean}>`
  cursor: pointer;
  ${({focused, theme}) =>
    focused &&
    css`
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
      ? css`
          background: ${p.theme.colors.gray400};
          border: 1px solid ${p.theme.colors.gray400};
          &:hover {
            background: ${p.theme.colors.gray500};
          }
        `
      : css`
          background: ${p.theme.tokens.background.accent.vibrant};
          border: 1px solid ${p.theme.tokens.border.accent.vibrant};
          &:hover {
            background: ${p.theme.tokens.background.transparent.accent.muted};
          }
        `}
`;
