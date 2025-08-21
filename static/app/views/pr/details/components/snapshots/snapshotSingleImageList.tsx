import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text/text';

import type {Snapshot} from './types';

interface SnapshotSingleImageListProps {
  snapshots: Snapshot[];
}

export default function SnapshotSingleImageList({
  snapshots,
}: SnapshotSingleImageListProps) {
  if (snapshots.length === 0) {
    return (
      <EmptyState>
        <Text size="lg" variant="muted">
          No snapshots found
        </Text>
      </EmptyState>
    );
  }

  return (
    <SnapshotContainer>
      <SnapshotGrid>
        {snapshots.map(snapshot => (
          <SnapshotCard key={snapshot.id}>
            <SnapshotImageContainer>
              <SnapshotImage
                src={snapshot.imageUrl}
                alt={snapshot.title}
                loading="lazy"
                width={snapshot.width}
                height={snapshot.height}
              />
            </SnapshotImageContainer>
            <SnapshotDetails>
              <SnapshotTitle>{snapshot.title}</SnapshotTitle>
              {snapshot.subtitle && (
                <SnapshotSubtitle>{snapshot.subtitle}</SnapshotSubtitle>
              )}
              <SnapshotDimensions>
                {snapshot.width} × {snapshot.height}
              </SnapshotDimensions>
            </SnapshotDetails>
          </SnapshotCard>
        ))}
      </SnapshotGrid>
    </SnapshotContainer>
  );
}

const EmptyState = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.lg};
  text-align: center;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 8px;
  margin: ${p => p.theme.space.md};
`;

const SnapshotContainer = styled('div')`
  /* Removed max-height and overflow-y to allow full page scroll */
`;

const SnapshotGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.sm};
`;

const SnapshotCard = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: 12px;
  padding: ${p => p.theme.space.md};
  transition: all 0.2s ease-in-out;
  cursor: pointer;

  &:hover {
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`;

const SnapshotImageContainer = styled('div')`
  position: relative;
  background:
    linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
  width: 120px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: ${p => p.theme.space.md};
`;

const SnapshotImage = styled('img')`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background: transparent;
`;

const SnapshotDetails = styled('div')`
  flex: 1;
  min-width: 0;
`;

const SnapshotTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  margin-bottom: ${p => p.theme.space.sm};
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SnapshotSubtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin-bottom: ${p => p.theme.space.sm};
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SnapshotDimensions = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-family: ${p => p.theme.text.familyMono};
  background: ${p => p.theme.gray100};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border-radius: 4px;
  display: inline-block;
`;
