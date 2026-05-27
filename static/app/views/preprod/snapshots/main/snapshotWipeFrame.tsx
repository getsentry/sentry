import type {CSSProperties} from 'react';
import styled from '@emotion/styled';

import {NegativeSpaceContainer} from 'sentry/components/container/negativeSpaceContainer';
import type {SnapshotImage} from 'sentry/views/preprod/types/snapshotTypes';

export function getSnapshotWipeFrameStyle({
  baseImage,
  headImage,
  maxHeight,
}: {
  baseImage: SnapshotImage;
  headImage: SnapshotImage;
  maxHeight: string;
}): CSSProperties {
  const width = Math.max(baseImage.width || 0, headImage.width || 0);
  const height = Math.max(baseImage.height || 0, headImage.height || 0);

  if (!width || !height) {
    return {width: '100%'};
  }

  return {
    aspectRatio: `${width} / ${height}`,
    width: `min(100%, ${width}px, calc(${maxHeight} * ${width / height}))`,
  };
}

const BORDER_WIDTH = 3;

export const SnapshotWipeShell = styled(NegativeSpaceContainer)<{$minHeight?: string}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: ${p => p.$minHeight ?? 0};
  padding: ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    box-sizing: border-box;
    border-radius: ${p => p.theme.radius.md};
    pointer-events: none;
  }

  &::after {
    z-index: 2;
    border: ${BORDER_WIDTH}px solid ${p => p.theme.tokens.border.success.moderate};
  }

  &::before {
    z-index: 3;
    width: clamp(
      ${BORDER_WIDTH}px,
      var(--divider-position, 50%),
      calc(100% - ${BORDER_WIDTH}px)
    );
    border: ${BORDER_WIDTH}px solid ${p => p.theme.tokens.border.danger.moderate};
    border-right-width: 0;
    border-radius: ${p => p.theme.radius.md} 0 0 ${p => p.theme.radius.md};
  }
`;

export const SnapshotWipeFrame = styled('div')`
  position: relative;
  z-index: 1;
  flex-shrink: 0;
`;

export const SnapshotWipeImage = styled('img')`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;
