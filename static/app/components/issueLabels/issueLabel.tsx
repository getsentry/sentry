import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {IssueLabel as IssueLabelType} from 'sentry/hooks/useIssueLabels';
import {IconClose} from 'sentry/icons';
import {space} from 'sentry/styles/space';

interface IssueLabelProps {
  label: IssueLabelType;
  onRemove?: (labelId: string) => void;
  showRemoveButton?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export function IssueLabel({
  label,
  onRemove,
  size = 'sm',
  showRemoveButton = false,
}: IssueLabelProps) {
  const handleRemove = () => {
    if (onRemove) {
      onRemove(label.id);
    }
  };

  return (
    <LabelContainer size={size} color={label.color}>
      <LabelText size={size}>{label.name}</LabelText>
      {showRemoveButton && onRemove && (
        <RemoveButton
          size="zero"
          icon={<IconClose size="xs" />}
          onClick={handleRemove}
          aria-label={`Remove label ${label.name}`}
        />
      )}
    </LabelContainer>
  );
}

const LabelContainer = styled('div')<{color: string; size: string}>`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
  background-color: ${p => p.color}20;
  border: 1px solid ${p => p.color}40;
  border-radius: ${p => (p.size === 'xs' ? '8px' : p.size === 'sm' ? '12px' : '16px')};
  padding: ${p =>
    p.size === 'xs' ? '2px 6px' : p.size === 'sm' ? '4px 8px' : '6px 10px'};
  font-size: ${p => (p.size === 'xs' ? '11px' : p.size === 'sm' ? '12px' : '14px')};
  font-weight: 500;
  color: ${p => p.color};
  white-space: nowrap;
  max-width: 200px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${p => p.color}30;
    border-color: ${p => p.color}60;
  }
`;

const LabelText = styled('span')<{size: string}>`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: inherit;
  line-height: 1.2;
`;

const RemoveButton = styled(Button)`
  padding: 0;
  min-width: auto;
  height: auto;
  color: inherit;
  opacity: 0.7;

  &:hover {
    opacity: 1;
    background-color: transparent;
  }
`;
