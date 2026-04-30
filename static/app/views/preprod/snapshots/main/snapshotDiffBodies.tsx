import {memo, type ReactNode, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Slider} from '@sentry/scraps/slider';
import {Text} from '@sentry/scraps/text';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {SnapshotImage} from 'sentry/views/preprod/types/snapshotTypes';
import {getImageName} from 'sentry/views/preprod/types/snapshotTypes';

import {useSyncedD3Zoom} from './imageDisplay/useD3Zoom';
import {ZoomControls, zoomTransformStyle} from './imageDisplay/zoomControls';

export const MAX_IMAGE_HEIGHT = 480;

function computeMaskSize(baseImage: SnapshotImage, headImage: SnapshotImage): string {
  const headW = headImage.width;
  const headH = headImage.height;
  if (!headW || !headH) {
    return '100% 100%';
  }
  const maskW = Math.max(baseImage.width || headW, headW);
  const maskH = Math.max(baseImage.height || headH, headH);
  return `${(maskW / headW) * 100}% ${(maskH / headH) * 100}%`;
}

export const SplitPairBody = memo(function SplitPairBody({
  baseUrl,
  headUrl,
  baseImage,
  headImage,
  headLabel,
  altPrefix,
  overlayColor,
  diffImageKey,
  diffImageBaseUrl,
}: {
  altPrefix: string;
  baseImage: SnapshotImage;
  baseUrl: string;
  headImage: SnapshotImage;
  headLabel: string;
  headUrl: string;
  diffImageBaseUrl?: string;
  diffImageKey?: string | null;
  overlayColor?: string;
}) {
  const [zoom1, zoom2] = useSyncedD3Zoom({wheelRequiresModifier: true});
  const hasVisibleOverlay = !!overlayColor && overlayColor !== 'transparent';
  const diffMaskUrl =
    hasVisibleOverlay && diffImageKey && diffImageBaseUrl
      ? `${diffImageBaseUrl}${diffImageKey}/`
      : null;
  return (
    <Container position="relative">
      <Grid columns="1fr 1fr" gap="0">
        <Stack minWidth="0">
          <Container padding="sm xl" borderBottom="secondary">
            <Text size="xs" variant="muted" ellipsis monospace>
              {t('Base')}
            </Text>
          </Container>
          <ZoomViewport ref={zoom1.containerRef}>
            <ZoomTransformLayer style={zoomTransformStyle(zoom1.transform)}>
              <LazyImage
                src={baseUrl}
                alt={`${altPrefix} (base)`}
                width={baseImage.width || undefined}
                height={baseImage.height || undefined}
              />
            </ZoomTransformLayer>
          </ZoomViewport>
        </Stack>
        <Stack minWidth="0" borderLeft="secondary">
          <Container padding="sm xl" borderBottom="secondary">
            <Text size="xs" variant="muted" ellipsis monospace>
              {headLabel}
            </Text>
          </Container>
          <ZoomViewport ref={zoom2.containerRef}>
            <ZoomTransformLayer style={zoomTransformStyle(zoom2.transform)}>
              <LazyImage
                src={headUrl}
                alt={`${altPrefix} (head)`}
                width={headImage.width || undefined}
                height={headImage.height || undefined}
              >
                {diffMaskUrl && (
                  <DiffOverlay
                    $overlayColor={overlayColor!}
                    $maskUrl={diffMaskUrl}
                    $maskSize={computeMaskSize(baseImage, headImage)}
                  />
                )}
              </LazyImage>
            </ZoomTransformLayer>
          </ZoomViewport>
        </Stack>
      </Grid>
      <ZoomControls
        onZoomIn={zoom1.zoomIn}
        onZoomOut={zoom1.zoomOut}
        onReset={zoom1.resetZoom}
      />
    </Container>
  );
});

export const ImageColumn = memo(function ImageColumn({
  label,
  src,
  alt,
  image,
  overlayColor,
  diffImageKey,
  diffImageBaseUrl,
}: {
  alt: string;
  image: SnapshotImage;
  src: string;
  diffImageBaseUrl?: string;
  diffImageKey?: string | null;
  label?: string | null;
  overlayColor?: string;
}) {
  const hasVisibleOverlay = !!overlayColor && overlayColor !== 'transparent';
  const diffMaskUrl =
    hasVisibleOverlay && diffImageKey && diffImageBaseUrl
      ? `${diffImageBaseUrl}${diffImageKey}/`
      : null;
  return (
    <Stack minWidth="0">
      {label && (
        <Container padding="sm xl" borderBottom="secondary">
          <Text size="xs" variant="muted" ellipsis monospace>
            {label}
          </Text>
        </Container>
      )}
      <Flex justify="center" padding="xl">
        <LazyImage
          src={src}
          alt={alt}
          width={image.width || undefined}
          height={image.height || undefined}
        >
          {diffMaskUrl && (
            <DiffOverlay
              $overlayColor={overlayColor!}
              $maskUrl={diffMaskUrl}
              $maskSize="100% 100%"
            />
          )}
        </LazyImage>
      </Flex>
    </Stack>
  );
});

const WIPE_MIN_HEIGHT = 160;

export const WipeCardBody = memo(function WipeCardBody({
  baseUrl,
  headUrl,
  baseImage,
  headImage,
}: {
  baseImage: SnapshotImage;
  baseUrl: string;
  headImage: SnapshotImage;
  headUrl: string;
}) {
  const naturalHeight = Math.max(headImage.height || 0, baseImage.height || 0);
  const minHeight = naturalHeight
    ? `${Math.min(Math.max(naturalHeight, WIPE_MIN_HEIGHT), MAX_IMAGE_HEIGHT)}px`
    : `${WIPE_MIN_HEIGHT}px`;
  return (
    <Flex padding="xl">
      <ContentSliderDiff.Body
        before={
          <Flex justify="center" align="center" width="100%" height="100%">
            <WipeImg
              src={baseUrl}
              alt={`${getImageName(baseImage)} (base)`}
              loading="lazy"
              decoding="async"
              width={baseImage.width || undefined}
              height={baseImage.height || undefined}
            />
          </Flex>
        }
        after={
          <Flex justify="center" align="center" width="100%" height="100%">
            <WipeImg
              src={headUrl}
              alt={`${getImageName(headImage)} (head)`}
              loading="lazy"
              decoding="async"
              width={headImage.width || undefined}
              height={headImage.height || undefined}
            />
          </Flex>
        }
        minHeight={minHeight}
      />
    </Flex>
  );
});

export const OnionCardBody = memo(function OnionCardBody({
  baseUrl,
  headUrl,
  baseImage,
  headImage,
}: {
  baseImage: SnapshotImage;
  baseUrl: string;
  headImage: SnapshotImage;
  headUrl: string;
}) {
  const [opacity, setOpacity] = useState(50);
  const maxW = Math.max(baseImage.width || 0, headImage.width || 0);
  const maxH = Math.max(baseImage.height || 0, headImage.height || 0);
  // Scale max-width so aspect-ratio doesn't collide with MAX_IMAGE_HEIGHT (prevents horizontal stretching)
  const heightScale = maxH > MAX_IMAGE_HEIGHT ? MAX_IMAGE_HEIGHT / maxH : 1;
  const displayMaxW = maxW * heightScale;
  const basePct = {
    width: maxW ? `${((baseImage.width || 0) / maxW) * 100}%` : '100%',
    height: maxH ? `${((baseImage.height || 0) / maxH) * 100}%` : '100%',
  };
  const headPct = {
    width: maxW ? `${((headImage.width || 0) / maxW) * 100}%` : '100%',
    height: maxH ? `${((headImage.height || 0) / maxH) * 100}%` : '100%',
  };
  return (
    <Flex direction="column" gap="md" padding="lg" align="center">
      <Container
        position="relative"
        width="100%"
        maxWidth={displayMaxW ? `${displayMaxW}px` : undefined}
        style={{
          aspectRatio: maxW && maxH ? `${maxW} / ${maxH}` : undefined,
        }}
      >
        <OnionImg
          src={baseUrl}
          alt={`${getImageName(baseImage)} (base)`}
          loading="lazy"
          decoding="async"
          style={basePct}
        />
        <OnionImg
          src={headUrl}
          alt={`${getImageName(headImage)} (head)`}
          loading="lazy"
          decoding="async"
          style={{...headPct, opacity: opacity / 100}}
        />
      </Container>
      <Flex align="center" gap="sm" width="100%" justify="center">
        <Text size="xs" variant="muted">
          {t('Base')}
        </Text>
        <Flex width="200px">
          <Slider
            min={0}
            max={100}
            value={opacity}
            onChange={setOpacity}
            formatOptions={{style: 'unit', unit: 'percent'}}
          />
        </Flex>
        <Text size="xs" variant="muted">
          {t('Head')}
        </Text>
      </Flex>
    </Flex>
  );
});

function LazyImage({
  src,
  alt,
  width,
  height,
  children,
}: {
  alt: string;
  src: string;
  children?: ReactNode;
  height?: number;
  width?: number;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  const onLoad = useCallback(() => setLoaded(true), []);
  const onError = useCallback(() => setLoaded(true), []);
  const refCallback = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);
  const displayHeight =
    width && height ? `${Math.min(height, MAX_IMAGE_HEIGHT)}px` : `${MAX_IMAGE_HEIGHT}px`;
  return (
    <Container position="relative" display="inline-block" maxWidth="100%">
      {!loaded && (
        <Placeholder
          width={width ? `${width}px` : '100%'}
          height={displayHeight}
          style={{maxWidth: '100%', maxHeight: `${MAX_IMAGE_HEIGHT}px`}}
        />
      )}
      <HiddenUntilLoaded
        ref={refCallback}
        src={src}
        alt={alt}
        width={width || undefined}
        height={height || undefined}
        onLoad={onLoad}
        onError={onError}
        style={loaded ? undefined : {position: 'absolute', top: 0, left: 0, opacity: 0}}
      />
      {children}
    </Container>
  );
}

const HiddenUntilLoaded = styled('img')`
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: ${MAX_IMAGE_HEIGHT}px;
`;

const DiffOverlay = styled('span')<{
  $maskSize: string;
  $maskUrl: string;
  $overlayColor: string;
}>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background-color: ${p => p.$overlayColor};
  mask-image: url(${p => p.$maskUrl});
  mask-size: ${p => p.$maskSize};
  mask-position: top left;
  mask-mode: luminance;
  -webkit-mask-image: url(${p => p.$maskUrl});
  -webkit-mask-size: ${p => p.$maskSize};
  -webkit-mask-position: top left;
`;

const ZoomViewport = styled('div')`
  position: relative;
  display: flex;
  justify-content: center;
  padding: ${p => p.theme.space.xl};
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  &:active {
    cursor: grabbing;
  }
`;

const ZoomTransformLayer = styled('div')`
  transform-origin: 0 0;
  will-change: transform;
`;

const WipeImg = styled('img')`
  display: block;
  max-width: 100%;
  max-height: ${MAX_IMAGE_HEIGHT}px;
  height: auto;
  object-fit: contain;
`;

const OnionImg = styled('img')`
  position: absolute;
  top: 0;
  left: 0;
  display: block;
`;
