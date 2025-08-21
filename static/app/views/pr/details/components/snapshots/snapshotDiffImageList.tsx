import React from 'react';
import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text/text';
import {space} from 'sentry/styles/space';

import type {SnapshotDiff} from './types';

interface SnapshotDiffImageListProps {
  diffs: SnapshotDiff[];
}

export default function SnapshotDiffImageList({diffs}: SnapshotDiffImageListProps) {
  if (diffs.length === 0) {
    return (
      <EmptyState>
        <Text size="lg" variant="muted">
          No differences found
        </Text>
      </EmptyState>
    );
  }

  // Filter out diffs with missing diffImageInfo
  const validDiffs = diffs.filter(diff => diff.diffImageInfo?.imageUrl);

  if (validDiffs.length === 0) {
    return (
      <EmptyState>
        <Text size="lg" variant="muted">
          No valid image differences found
        </Text>
      </EmptyState>
    );
  }

  return (
    <React.Fragment>
      <DiffGrid>
        {validDiffs.map(diff => (
          <DiffCard key={`${diff.baseSnapshot.id}-${diff.headSnapshot.id}`}>
            <DiffImageContainer>
              <DiffImage
                src={diff.diffImageInfo.imageUrl}
                alt={`${diff.headSnapshot.title} diff`}
                loading="lazy"
              />
            </DiffImageContainer>
            <DiffDetails>
              <DiffTitle>{diff.headSnapshot.title}</DiffTitle>
              {diff.headSnapshot.subtitle && (
                <DiffSubtitle>{diff.headSnapshot.subtitle}</DiffSubtitle>
              )}
            </DiffDetails>
            {diff.diff && (
              <DiffPercentage>{(diff.diff * 100).toFixed(1)}% diff</DiffPercentage>
            )}
          </DiffCard>
        ))}
      </DiffGrid>
    </React.Fragment>
  );
}

const EmptyState = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(4)};
  text-align: center;
`;

const DiffGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: ${space(3)};
  padding: ${space(2)};
`;

const DiffCard = styled('div')`
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 8px;
  padding: ${space(2)};
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }
`;

const DiffImageContainer = styled('div')`
  position: relative;
  background: ${p => p.theme.gray100};
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: ${space(2)};
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;

  &:hover .overlay-button {
    opacity: 1;
  }
`;

const DiffImage = styled('img')`
  max-width: 100%;
  max-height: 400px;
  width: auto;
  height: auto;
  object-fit: contain;
  background: ${p => p.theme.gray100};
`;

const DiffPercentage = styled('div')`
  background: rgba(255, 69, 58, 0.9);
  color: white;
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: 12px;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  align-self: flex-start;
  margin-top: ${space(1)};
`;

const DiffDetails = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const DiffTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DiffSubtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.gray300};
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
