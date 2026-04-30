import {useState} from 'react';
import styled from '@emotion/styled';

import {Image} from '@sentry/scraps/image';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Slider} from '@sentry/scraps/slider';
import {Heading, Text} from '@sentry/scraps/text';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {t} from 'sentry/locale';
import {computeMaskSize} from 'sentry/views/preprod/snapshots/main/computeMaskSize';
import type {SnapshotDiffPair} from 'sentry/views/preprod/types/snapshotTypes';

import {useBufferedImageGroup} from './useBufferedImageUrl';
import {useSyncedD3Zoom} from './useD3Zoom';
import {
  ZoomableArea,
  ZoomableImage,
  ZoomContainer,
  ZoomControls,
  zoomTransformStyle,
} from './zoomControls';

export type DiffMode = 'split' | 'wipe' | 'onion';

export const TRANSPARENT_COLOR = 'transparent';

interface DiffImageDisplayProps {
  diffImageBaseUrl: string;
  diffMode: DiffMode;
  imageBaseUrl: string;
  overlayColor: string;
  pair: SnapshotDiffPair;
}

export function DiffImageDisplay({
  pair,
  imageBaseUrl,
  diffImageBaseUrl,
  overlayColor,
  diffMode,
}: DiffImageDisplayProps) {
  const [onionOpacity, setOnionOpacity] = useState(50);

  const baseImageUrl = `${imageBaseUrl}${pair.base_image.key}/`;
  const headImageUrl = `${imageBaseUrl}${pair.head_image.key}/`;
  const diffMaskUrl = pair.diff_image_key
    ? `${diffImageBaseUrl}${pair.diff_image_key}/`
    : null;

  const maskSize = computeMaskSize(pair.base_image, pair.head_image);

  return (
    <Flex direction="column" gap="lg" padding="xl" flex="1" minHeight="0">
      <HiddenWhenInactive active={diffMode === 'split'}>
        <SplitView
          baseImageUrl={baseImageUrl}
          headImageUrl={headImageUrl}
          overlayColor={overlayColor}
          diffMaskUrl={diffMaskUrl}
          maskSize={maskSize}
        />
      </HiddenWhenInactive>

      <HiddenWhenInactive active={diffMode === 'wipe'}>
        <WipeView baseImageUrl={baseImageUrl} headImageUrl={headImageUrl} />
      </HiddenWhenInactive>

      <HiddenWhenInactive active={diffMode === 'onion'}>
        <OnionView
          baseImageUrl={baseImageUrl}
          headImageUrl={headImageUrl}
          opacity={onionOpacity}
          onOpacityChange={setOnionOpacity}
        />
      </HiddenWhenInactive>
    </Flex>
  );
}

interface SplitViewProps {
  baseImageUrl: string;
  diffMaskUrl: string | null;
  headImageUrl: string;
  maskSize: string;
  overlayColor: string;
}

function SplitView({
  baseImageUrl,
  headImageUrl,
  overlayColor,
  diffMaskUrl,
  maskSize,
}: SplitViewProps) {
  const [zoom1, zoom2] = useSyncedD3Zoom();
  const [displayBaseUrl, displayHeadUrl, displayMaskUrl] = useBufferedImageGroup([
    baseImageUrl,
    headImageUrl,
    diffMaskUrl,
  ]);
  const showOverlay = displayMaskUrl && overlayColor !== TRANSPARENT_COLOR;
  return (
    <Grid columns="repeat(2, 1fr)" gap="xl" flex="1" minHeight="0">
      <Flex direction="column" gap="sm" minHeight="0">
        <Heading as="h4">{t('Base')}</Heading>
        <ZoomableArea>
          <ZoomContainer ref={zoom1.containerRef}>
            <Flex
              justify="center"
              align="center"
              width="100%"
              height="100%"
              style={zoomTransformStyle(zoom1.transform)}
            >
              {displayBaseUrl && (
                <ZoomableImage
                  src={displayBaseUrl}
                  alt={t('Base')}
                  loading="eager"
                  decoding="async"
                />
              )}
            </Flex>
          </ZoomContainer>
        </ZoomableArea>
      </Flex>

      <Flex direction="column" gap="sm" minHeight="0">
        <Heading as="h4">{t('Current Branch')}</Heading>
        <ZoomableArea>
          <ZoomContainer ref={zoom2.containerRef}>
            <Flex
              justify="center"
              align="center"
              width="100%"
              height="100%"
              style={zoomTransformStyle(zoom2.transform)}
            >
              {displayHeadUrl && (
                <ImageWrapper>
                  <ZoomableImage
                    src={displayHeadUrl}
                    alt={t('Current Branch')}
                    loading="eager"
                    decoding="async"
                  />
                  {showOverlay && displayMaskUrl && (
                    <DiffOverlay
                      $overlayColor={overlayColor}
                      $maskUrl={displayMaskUrl}
                      $maskSize={maskSize}
                    />
                  )}
                </ImageWrapper>
              )}
            </Flex>
          </ZoomContainer>
          <ZoomControls
            onZoomIn={zoom2.zoomIn}
            onZoomOut={zoom2.zoomOut}
            onReset={zoom2.resetZoom}
          />
        </ZoomableArea>
      </Flex>
    </Grid>
  );
}

function WipeView({
  baseImageUrl,
  headImageUrl,
}: {
  baseImageUrl: string;
  headImageUrl: string;
}) {
  const [displayBaseUrl, displayHeadUrl] = useBufferedImageGroup([
    baseImageUrl,
    headImageUrl,
  ]);
  return (
    <Flex flex="1" minHeight="0">
      {displayBaseUrl && displayHeadUrl && (
        <ContentSliderDiff.Body
          before={
            <Flex justify="center" align="center" height="100%">
              <ConstrainedImage
                src={displayBaseUrl}
                alt={t('Base')}
                loading="eager"
                decoding="async"
              />
            </Flex>
          }
          after={
            <Flex justify="center" align="center" height="100%">
              <ConstrainedImage
                src={displayHeadUrl}
                alt={t('Current Branch')}
                loading="eager"
                decoding="async"
              />
            </Flex>
          }
          minHeight="200px"
        />
      )}
    </Flex>
  );
}

function OnionView({
  baseImageUrl,
  headImageUrl,
  opacity,
  onOpacityChange,
}: {
  baseImageUrl: string;
  headImageUrl: string;
  onOpacityChange: (value: number) => void;
  opacity: number;
}) {
  const [displayBaseUrl, displayHeadUrl] = useBufferedImageGroup([
    baseImageUrl,
    headImageUrl,
  ]);
  return (
    <Flex
      direction="column"
      gap="md"
      flex="1"
      minHeight="0"
      align="center"
      justify="center"
    >
      {displayBaseUrl && displayHeadUrl && (
        <Flex
          justify="center"
          border="primary"
          radius="md"
          overflow="hidden"
          background="secondary"
        >
          <OnionContainer>
            <ConstrainedImage
              src={displayBaseUrl}
              alt={t('Base')}
              loading="eager"
              decoding="async"
            />
            <OnionOverlayLayer style={{opacity: opacity / 100}}>
              <ConstrainedImage
                src={displayHeadUrl}
                alt={t('Current Branch')}
                loading="eager"
                decoding="async"
              />
            </OnionOverlayLayer>
          </OnionContainer>
        </Flex>
      )}
      <Flex align="center" gap="lg">
        <Text size="sm" variant="muted">
          {t('Base')}
        </Text>
        <Flex width="200px">
          <Slider
            min={0}
            max={100}
            value={opacity}
            onChange={onOpacityChange}
            formatOptions={{style: 'unit', unit: 'percent'}}
          />
        </Flex>
        <Text size="sm" variant="muted">
          {t('Head')}
        </Text>
      </Flex>
    </Flex>
  );
}

const ConstrainedImage = styled(Image)`
  max-height: 65vh;
  width: auto;
`;

const ImageWrapper = styled('div')`
  position: relative;
  display: inline-block;
  max-width: 100%;
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

const OnionContainer = styled('div')`
  position: relative;
  display: inline-block;
`;

const OnionOverlayLayer = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const HiddenWhenInactive = styled('div')<{active: boolean}>`
  display: ${p => (p.active ? 'contents' : 'none')};
`;
