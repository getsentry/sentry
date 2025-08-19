import styled from '@emotion/styled';

import type {IssueLabel as IssueLabelType} from 'sentry/hooks/useIssueLabels';
import {space} from 'sentry/styles/space';

import {IssueLabel} from './issueLabel';

interface IssueLabelListProps {
  labels: IssueLabelType[];
  maxLabels?: number;
  onRemoveLabel?: (labelId: string) => void;
  showRemoveButtons?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export function IssueLabelList({
  labels,
  onRemoveLabel,
  size = 'sm',
  showRemoveButtons = false,
  maxLabels,
}: IssueLabelListProps) {
  if (!labels.length) {
    return null;
  }

  const displayLabels = maxLabels ? labels.slice(0, maxLabels) : labels;
  const hasMore = maxLabels ? labels.length > maxLabels : false;

  return (
    <LabelListContainer>
      {displayLabels.map(label => (
        <IssueLabel
          key={label.id}
          label={label}
          onRemove={onRemoveLabel}
          size={size}
          showRemoveButton={showRemoveButtons}
        />
      ))}
      {hasMore && (
        <MoreLabelsIndicator>+{labels.length - maxLabels!} more</MoreLabelsIndicator>
      )}
    </LabelListContainer>
  );
}

const LabelListContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.25)};
  align-items: center;
  padding: ${space(0.5)} 0;
`;

// Removed LabelSeparator - no dividers between labels

const MoreLabelsIndicator = styled('span')`
  font-size: 11px;
  color: ${p => p.theme.subText};
  font-style: italic;
  margin-left: ${space(0.5)};
`;
