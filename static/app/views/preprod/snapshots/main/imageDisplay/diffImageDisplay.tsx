import {useEffect, useState} from 'react';
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

  const baseImageUrl = `${imageBaseUrl}${pair.base_image.key}/`;
  const headImageUrl = `${imageBaseUrl}${pair.head_image.key}/`;
  const diffImageUrl = pair.diff_image_key
    ? `${diffImageBaseUrl}${pair.diff_image_key}`
    : null;

  useEffect(() => {
    if (!diffImageUrl) {
      return undefined;
    }
    let cancelled = false;
    fetch(diffImageUrl)
      .then(r => r.blob())
      .then(blob => {
        if (!cancelled) {
          setDiffMaskUrl(URL.createObjectURL(blob));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (diffMaskUrl) {
        URL.revokeObjectURL(diffMaskUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffImageUrl]);

  const diffPercent = pair.diff === null ? null : `${(pair.diff * 100).toFixed(1)}%`;

  return (
    <Flex direction="column" gap="lg" padding="xl" height="100%">
      {diffPercent && (
        <Text variant="muted" size="sm">
          {t('Diff: %s', diffPercent)}
        </Text>
      )}
      <TwoColumnGrid gap="xl">
        <Flex direction="column" gap="sm">
          <Heading as="h4">{t('Base')}</Heading>
          <Container
            border="primary"
            radius="md"
            overflow="hidden"
            background="secondary"
          >
            <Image src={baseImageUrl} alt={t('Base')} />
          </Container>
        </Flex>

        <Flex direction="column" gap="sm">
          <Heading as="h4">{t('Current Branch')}</Heading>
          <Container
            border="primary"
            radius="md"
            overflow="hidden"
            background="secondary"
          >
            <ImageWrapper>
              <Image src={headImageUrl} alt={t('Current Branch')} />
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
          </Container>
        </Flex>
      </TwoColumnGrid>
    </Flex>
  );
}

const TwoColumnGrid = styled(Grid)`
  grid-template-columns: 1fr 1fr;
  flex: 1;
  min-height: 0;
`;

const ImageWrapper = styled('div')`
  position: relative;
  width: 100%;
`;

const DiffOverlay = styled('span')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;
