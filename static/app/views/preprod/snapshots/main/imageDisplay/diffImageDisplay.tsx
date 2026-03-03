import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Image} from '@sentry/scraps/image';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {SnapshotDiffPair} from 'sentry/views/preprod/types/snapshotTypes';

interface DiffImageDisplayProps {
  diffImageBaseUrl: string;
  imageBaseUrl: string;
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
}: DiffImageDisplayProps) {
  const [diffMaskUrl, setDiffMaskUrl] = useState<string | null>(null);
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
      .then(r => r.blob())
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
      <Grid columns="repeat(2, 1fr)" gap="xl" flex="1" minHeight="0">
        <Flex direction="column" gap="sm">
          <Heading as="h4">{t('Base')}</Heading>
          <CenteredContainer
            border="primary"
            radius="md"
            overflow="hidden"
            background="secondary"
          >
            <ConstrainedImage src={baseImageUrl} alt={t('Base')} />
          </CenteredContainer>
        </Flex>

        <Flex direction="column" gap="sm">
          <Heading as="h4">{t('Current Branch')}</Heading>
          <CenteredContainer
            border="primary"
            radius="md"
            overflow="hidden"
            background="secondary"
          >
            <ImageWrapper>
              <ConstrainedImage src={headImageUrl} alt={t('Current Branch')} />
              {showOverlay && diffMaskUrl && (
                <DiffOverlay
                  style={{
                    backgroundColor: overlayColor,
                    maskImage: `url(${diffMaskUrl})`,
                    maskSize: '100% 100%',
                    maskMode: 'luminance',
                    WebkitMaskImage: `url(${diffMaskUrl})`,
                    WebkitMaskSize: '100% 100%',
                  }}
                />
              )}
            </ImageWrapper>
          </CenteredContainer>
        </Flex>
      </Grid>
    </Flex>
  );
}

const CenteredContainer = styled(Container)`
  display: flex;
  justify-content: center;
`;

const ConstrainedImage = styled(Image)`
  max-height: 65vh;
  width: auto;
`;

const ImageWrapper = styled('div')`
  position: relative;
`;

const DiffOverlay = styled('span')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;
