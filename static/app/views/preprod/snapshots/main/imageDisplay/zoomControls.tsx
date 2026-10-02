import styled from '@emotion/styled';
import type {ZoomTransform} from 'd3-zoom';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Hotkey, Kbd} from '@sentry/scraps/hotkey';
import {Image} from '@sentry/scraps/image';
import {Container, Flex} from '@sentry/scraps/layout';

import {IconAdd, IconRefresh, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';

interface ZoomControlsProps {
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

function ScrollHint({label}: {label: string}) {
  return (
    <Flex align="center" gap="xs">
      {label}
      <Hotkey value="command" />
      <Kbd>{t('Scroll')}</Kbd>
    </Flex>
  );
}

export function ZoomControls({onZoomIn, onZoomOut, onReset}: ZoomControlsProps) {
  return (
    <Container
      position="absolute"
      bottom="8px"
      right="8px"
      style={{zIndex: 1}}
      onClick={e => e.stopPropagation()}
    >
      <ButtonBar>
        <Button
          size="xs"
          icon={<IconAdd />}
          aria-label={t('Zoom in')}
          tooltipProps={{title: <ScrollHint label={t('Zoom in')} />}}
          onClick={onZoomIn}
        />
        <Button
          size="xs"
          icon={<IconSubtract />}
          aria-label={t('Zoom out')}
          tooltipProps={{title: <ScrollHint label={t('Zoom out')} />}}
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

export function zoomTransformStyle(transform: ZoomTransform): React.CSSProperties {
  return {
    transformOrigin: '0 0',
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
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
