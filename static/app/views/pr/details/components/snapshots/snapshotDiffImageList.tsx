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

  return (
    <React.Fragment>
      <DiffGrid>
        {diffs.map(diff => (
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
              <DiffDimensions>
                {diff.width} � {diff.height}
              </DiffDimensions>
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
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding: ${space(2)};
  max-height: 70vh;
  overflow-y: auto;
`;

const DiffCard = styled('div')`
  display: flex;
  align-items: center;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 8px;
  padding: ${space(1.5)};
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
  width: 120px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  margin-right: ${space(2)};

  &:hover .overlay-button {
    opacity: 1;
  }
`;

const DiffImage = styled('img')`
  width: 100%;
  height: 100%;
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
  margin-left: auto;
  flex-shrink: 0;
`;

const DiffDetails = styled('div')`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const DiffTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(0.5)};
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DiffSubtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(0.5)};
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DiffDimensions = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.gray300};
  font-family: ${p => p.theme.text.familyMono};
`;
