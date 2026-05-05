import {useState} from 'react';
import styled from '@emotion/styled';

import {Image} from '@sentry/scraps/image';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Slider} from '@sentry/scraps/slider';
import {Text} from '@sentry/scraps/text';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {t} from 'sentry/locale';
import {computeMaskSize} from 'sentry/views/preprod/snapshots/main/computeMaskSize';
import {DiffOverlay} from 'sentry/views/preprod/snapshots/main/diffOverlay';
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
  headLabel?: string;
}

export function DiffImageDisplay({
  pair,
  imageBaseUrl,
  diffImageBaseUrl,
  overlayColor,
  diffMode,
  headLabel = t('Head'),
}: DiffImageDisplayProps) {
  const [onionOpacity, setOnionOpacity] = useState(50);

  const baseImageUrl = `${imageBaseUrl}${pair.base_image.key}/`;
  const headImageUrl = `${imageBaseUrl}${pair.head_image.key}/`;
  const diffMaskUrl = pair.diff_image_key
    ? `${diffImageBaseUrl}${pair.diff_image_key}/`
    : null;

  const maskSize = computeMaskSize(pair.base_image, pair.head_image);

  return (
    <Flex direction="column" gap="lg" padding="0 xl xl" flex="1" minHeight="0">
      <HiddenWhenInactive active={diffMode === 'split'}>
        <SplitView
          baseImageUrl={baseImageUrl}
          headImageUrl={headImageUrl}
          overlayColor={overlayColor}
          diffMaskUrl={diffMaskUrl}
          maskSize={maskSize}
          headLabel={headLabel}
        />
      </HiddenWhenInactive>

      <HiddenWhenInactive active={diffMode === 'wipe'}>
        <WipeView
          baseImageUrl={baseImageUrl}
          headImageUrl={headImageUrl}
          headLabel={headLabel}
        />
      </HiddenWhenInactive>

      <HiddenWhenInactive active={diffMode === 'onion'}>
        <OnionView
          baseImageUrl={baseImageUrl}
          headImageUrl={headImageUrl}
          opacity={onionOpacity}
          onOpacityChange={setOnionOpacity}
          headLabel={headLabel}
        />
      </HiddenWhenInactive>
    </Flex>
  );
}

interface SplitViewProps {
  baseImageUrl: string;
  diffMaskUrl: string | null;
  headImageUrl: string;
  headLabel: string;
  maskSize: string;
  overlayColor: string;
}

function SplitView({
  baseImageUrl,
  headImageUrl,
  headLabel,
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
    <ZoomableArea>
      <Grid columns="repeat(2, minmax(0, 1fr))" gap="0" height="100%" minHeight="0">
        <Flex direction="column" minWidth="0" minHeight="0">
          <Container padding="sm xl">
            <Text size="xs" variant="muted" ellipsis monospace>
              {t('Base')}
            </Text>
          </Container>
          <ZoomContainer ref={zoom1.containerRef} style={splitZoomContainerStyle}>
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
        </Flex>

        <Flex direction="column" minWidth="0" minHeight="0" borderLeft="secondary">
          <Container padding="sm xl">
            <Text size="xs" variant="muted" ellipsis monospace>
              {headLabel}
            </Text>
          </Container>
          <ZoomContainer ref={zoom2.containerRef} style={splitZoomContainerStyle}>
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
                    alt={headLabel}
                    loading="eager"
                    decoding="async"
                  />
                  {showOverlay && (
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
        </Flex>
      </Grid>
      <ZoomControls
        onZoomIn={zoom2.zoomIn}
        onZoomOut={zoom2.zoomOut}
        onReset={zoom2.resetZoom}
      />
    </ZoomableArea>
  );
}

const splitZoomContainerStyle: React.CSSProperties = {
  flex: '1 1 0',
  minHeight: 0,
  overflow: 'hidden',
};

function WipeView({
  baseImageUrl,
  headImageUrl,
  headLabel,
}: {
  baseImageUrl: string;
  headImageUrl: string;
  headLabel: string;
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
                alt={headLabel}
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
  headLabel,
  opacity,
  onOpacityChange,
}: {
  baseImageUrl: string;
  headImageUrl: string;
  headLabel: string;
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
                alt={headLabel}
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
