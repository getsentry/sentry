import styled from '@emotion/styled';
import type {ZoomTransform} from 'd3-zoom';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container} from '@sentry/scraps/layout';

import {IconAdd, IconRefresh, IconSubtract} from 'sentry/icons';

interface ZoomControlsProps {
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControls({onZoomIn, onZoomOut, onReset}: ZoomControlsProps) {
  return (
    <Container position="absolute" bottom="8px" right="8px" style={{zIndex: 1}}>
      <ButtonBar>
        <Button size="xs" icon={<IconAdd />} aria-label="Zoom in" onClick={onZoomIn} />
        <Button
          size="xs"
          icon={<IconSubtract />}
          aria-label="Zoom out"
          onClick={onZoomOut}
        />
        <Button
          size="xs"
          icon={<IconRefresh />}
          aria-label="Reset zoom"
          onClick={onReset}
        />
      </ButtonBar>
    </Container>
  );
}

export function zoomTransformStyle(t: ZoomTransform): React.CSSProperties {
  return {
    transformOrigin: '0 0',
    transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`,
  };
}

export function ZoomableArea({children}: {children: React.ReactNode}) {
  return (
    <Container
      position="relative"
      width="100%"
      height="100%"
      flex={1}
      minHeight={0}
      border="primary"
      radius="md"
      overflow="hidden"
      background="secondary"
    >
      {children}
    </Container>
  );
}

export const ZoomContainer = styled('div')`
  width: 100%;
  height: 100%;
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
`;

export const ZoomableImage = styled(Image)`
  width: auto;
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
`;
