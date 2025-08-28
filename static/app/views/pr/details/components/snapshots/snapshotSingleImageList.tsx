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
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: ${p => p.theme.space.lg};
  padding: ${p => p.theme.space.sm};
`;

const SnapshotCard = styled('div')`
  display: flex;
  flex-direction: column;
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
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${p => p.theme.space.md};
  min-height: 200px;
`;

const SnapshotImage = styled('img')`
  max-width: 100%;
  max-height: 400px;
  width: auto;
  height: auto;
  object-fit: contain;
  background: transparent;
`;

const SnapshotDetails = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
`;

const SnapshotTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SnapshotSubtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
