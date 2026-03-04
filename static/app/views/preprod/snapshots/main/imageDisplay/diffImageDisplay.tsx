import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Image} from '@sentry/scraps/image';
import {Flex, Grid} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Slider} from '@sentry/scraps/slider';
import {Heading, Text} from '@sentry/scraps/text';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {IconInput, IconPause, IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SnapshotDiffPair} from 'sentry/views/preprod/types/snapshotTypes';

import {useSyncedD3Zoom} from './useD3Zoom';
import {
  ZoomableArea,
  ZoomableImage,
  ZoomContainer,
  ZoomContent,
  ZoomControls,
  zoomTransformStyle,
} from './zoomControls';

export type DiffMode = 'split' | 'wipe' | 'onion';

interface DiffImageDisplayProps {
  diffImageBaseUrl: string;
  diffMode: DiffMode;
  imageBaseUrl: string;
  onDiffModeChange: (mode: DiffMode) => void;
  overlayColor: string;
  pair: SnapshotDiffPair;
  showOverlay: boolean;
}

export function DiffImageDisplay({
  pair,
  imageBaseUrl,
  diffImageBaseUrl,
  showOverlay,
  overlayColor,
  diffMode,
  onDiffModeChange,
}: DiffImageDisplayProps) {
  const [diffMaskUrl, setDiffMaskUrl] = useState<string | null>(null);
  const [onionOpacity, setOnionOpacity] = useState(50);
  const blobUrlRef = useRef<string | null>(null);

  const baseImageUrl = `${imageBaseUrl}${pair.base_image.key}/`;
  const headImageUrl = `${imageBaseUrl}${pair.head_image.key}/`;
  const diffImageUrl = pair.diff_image_key
    ? `${diffImageBaseUrl}${pair.diff_image_key}`
    : null;

  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setDiffMaskUrl(null);

    if (!diffImageUrl) {
      return undefined;
    }
    let cancelled = false;
    fetch(diffImageUrl)
      .then(r => {
        if (!r.ok) {
          throw new Error(`Failed to fetch diff image: ${r.status}`);
        }
        return r.blob();
      })
      .then(blob => {
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setDiffMaskUrl(url);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [diffImageUrl]);

  const diffPercent = pair.diff === null ? null : `${(pair.diff * 100).toFixed(1)}%`;

  return (
    <Flex direction="column" gap="lg" padding="xl" height="100%">
      {diffPercent && (
        <Text variant="muted" size="sm">
          {t('Diff: %s', diffPercent)}
        </Text>
      )}

      {diffMode === 'split' && (
        <SplitView
          baseImageUrl={baseImageUrl}
          headImageUrl={headImageUrl}
          showOverlay={showOverlay}
          overlayColor={overlayColor}
          diffMaskUrl={diffMaskUrl}
        />
      )}

      {diffMode === 'wipe' && (
        <WipeView baseImageUrl={baseImageUrl} headImageUrl={headImageUrl} />
      )}

      {diffMode === 'onion' && (
        <OnionView
          baseImageUrl={baseImageUrl}
          headImageUrl={headImageUrl}
          opacity={onionOpacity}
          onOpacityChange={setOnionOpacity}
        />
      )}

      <Flex justify="center">
        <SegmentedControl value={diffMode} onChange={onDiffModeChange}>
          <SegmentedControl.Item key="split" icon={<IconPause />}>
            {t('Split')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="wipe" icon={<IconInput />}>
            {t('Wipe')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="onion" icon={<IconStack />}>
            {t('Onion')}
          </SegmentedControl.Item>
        </SegmentedControl>
      </Flex>
    </Flex>
  );
}

interface SplitViewProps {
  baseImageUrl: string;
  diffMaskUrl: string | null;
  headImageUrl: string;
  overlayColor: string;
  showOverlay: boolean;
}

function SplitView({
  baseImageUrl,
  headImageUrl,
  showOverlay,
  overlayColor,
  diffMaskUrl,
}: SplitViewProps) {
  const [zoom1, zoom2] = useSyncedD3Zoom();
  return (
    <Grid columns="repeat(2, 1fr)" gap="xl" flex="1" minHeight="0">
      <Flex direction="column" gap="sm" minHeight="0">
        <Heading as="h4">{t('Base')}</Heading>
        <ZoomableArea>
          <ZoomContainer ref={zoom1.containerRef}>
            <ZoomContent style={zoomTransformStyle(zoom1.transform)}>
              <ZoomableImage src={baseImageUrl} alt={t('Base')} />
            </ZoomContent>
          </ZoomContainer>
        </ZoomableArea>
      </Flex>

      <Flex direction="column" gap="sm" minHeight="0">
        <Heading as="h4">{t('Current Branch')}</Heading>
        <ZoomableArea>
          <ZoomContainer ref={zoom2.containerRef}>
            <ZoomContent style={zoomTransformStyle(zoom2.transform)}>
              <ImageWrapper>
                <ZoomableImage src={headImageUrl} alt={t('Current Branch')} />
                {showOverlay && diffMaskUrl && (
                  <DiffOverlay $overlayColor={overlayColor} $maskUrl={diffMaskUrl} />
                )}
              </ImageWrapper>
            </ZoomContent>
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
  return (
    <Flex flex="1" minHeight="0">
      <ContentSliderDiff.Body
        before={
          <Flex justify="center" align="center" height="100%">
            <ConstrainedImage src={baseImageUrl} alt={t('Base')} />
          </Flex>
        }
        after={
          <Flex justify="center" align="center" height="100%">
            <ConstrainedImage src={headImageUrl} alt={t('Current Branch')} />
          </Flex>
        }
        minHeight="200px"
      />
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
  return (
    <Flex direction="column" gap="md" flex="1" minHeight="0" align="center">
      <Flex
        justify="center"
        border="primary"
        radius="md"
        overflow="hidden"
        background="secondary"
      >
        <OnionContainer>
          <ConstrainedImage src={baseImageUrl} alt={t('Base')} />
          <OnionOverlayLayer style={{opacity: opacity / 100}}>
            <ConstrainedImage src={headImageUrl} alt={t('Current Branch')} />
          </OnionOverlayLayer>
        </OnionContainer>
      </Flex>
      <Flex align="center" gap="sm">
        <Text size="sm" variant="muted">
          {t('Base')}
        </Text>
        <Flex width="200px">
          <Slider
            min={0}
            max={100}
            value={opacity}
            onChange={onOpacityChange}
            formatLabel={v => `${v}%`}
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
`;

const DiffOverlay = styled('span')<{$maskUrl: string; $overlayColor: string}>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background-color: ${p => p.$overlayColor};
  mask-image: url(${p => p.$maskUrl});
  mask-size: 100% 100%;
  mask-mode: luminance;
  -webkit-mask-image: url(${p => p.$maskUrl});
  -webkit-mask-size: 100% 100%;
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
