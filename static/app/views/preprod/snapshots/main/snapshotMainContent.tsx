import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getImageName} from 'sentry/views/preprod/types/snapshotTypes';
import type {SidebarItem} from 'sentry/views/preprod/types/snapshotTypes';

import {DiffImageDisplay, type DiffMode} from './imageDisplay/diffImageDisplay';
import {SingleImageDisplay} from './imageDisplay/singleImageDisplay';

interface SnapshotMainContentProps {
  diffImageBaseUrl: string;
  diffMode: DiffMode;
  imageBaseUrl: string;
  onDiffModeChange: (mode: DiffMode) => void;
  onOverlayColorChange: (color: string) => void;
  onShowOverlayChange: (show: boolean) => void;
  onVariantChange: (index: number) => void;
  overlayColor: string;
  selectedItem: SidebarItem | null;
  showOverlay: boolean;
  variantIndex: number;
}

export function SnapshotMainContent({
  selectedItem,
  variantIndex,
  onVariantChange,
  imageBaseUrl,
  diffImageBaseUrl,
  showOverlay,
  onShowOverlayChange,
  overlayColor,
  onOverlayColorChange,
  diffMode,
  onDiffModeChange,
}: SnapshotMainContentProps) {
  if (!selectedItem) {
    return (
      <Flex align="center" justify="center" padding="3xl" width="100%">
        <Text variant="muted">{t('Select an image from the sidebar.')}</Text>
      </Flex>
    );
  }

  if (selectedItem.type === 'changed') {
    const displayName = getImageName(selectedItem.pair.head_image);
    return (
      <Flex direction="column" gap="0" padding="0" height="100%" width="100%">
        <Flex align="center" justify="between" gap="md" padding="xl">
          <Text size="lg" bold>
            {displayName}
          </Text>
          {diffMode === 'split' && (
            <Flex align="center" gap="sm">
              <Button
                size="xs"
                priority={showOverlay ? 'primary' : 'default'}
                onClick={() => onShowOverlayChange(!showOverlay)}
              >
                {showOverlay ? t('Hide Overlay') : t('Show Overlay')}
              </Button>
              <ColorInput
                type="color"
                value={overlayColor}
                onChange={e => onOverlayColorChange(e.target.value)}
              />
            </Flex>
          )}
        </Flex>
        <Separator orientation="horizontal" />
        <DiffImageDisplay
          pair={selectedItem.pair}
          imageBaseUrl={imageBaseUrl}
          diffImageBaseUrl={diffImageBaseUrl}
          showOverlay={showOverlay}
          overlayColor={overlayColor}
          diffMode={diffMode}
          onDiffModeChange={onDiffModeChange}
        />
      </Flex>
    );
  }

  if (selectedItem.type === 'solo') {
    const currentImage = selectedItem.images[variantIndex];
    if (!currentImage) {
      return null;
    }
    const displayName = getImageName(currentImage);
    const totalVariants = selectedItem.images.length;
    const imageUrl = `${imageBaseUrl}${currentImage.key}/`;

    return (
      <Flex direction="column" gap="0" padding="0" height="100%" width="100%">
        <Flex align="center" gap="md" padding="xl">
          {totalVariants > 1 && (
            <Flex align="center" gap="sm">
              <Button
                size="md"
                priority="transparent"
                icon={<IconChevron direction="left" />}
                aria-label={t('Previous variant')}
                disabled={variantIndex === 0}
                onClick={() => onVariantChange(variantIndex - 1)}
              />
              <Button
                size="md"
                priority="transparent"
                icon={<IconChevron direction="right" />}
                aria-label={t('Next variant')}
                disabled={variantIndex === totalVariants - 1}
                onClick={() => onVariantChange(variantIndex + 1)}
              />
            </Flex>
          )}
          <Stack gap="md">
            <Text size="lg" bold>
              {displayName}
            </Text>
            {totalVariants > 1 && (
              <Text variant="muted" size="sm">
                {t('Variant %s / %s', variantIndex + 1, totalVariants)}
              </Text>
            )}
          </Stack>
        </Flex>
        <Separator orientation="horizontal" />
        <SingleImageDisplay imageUrl={imageUrl} alt={displayName} />
      </Flex>
    );
  }

  const image = selectedItem.image;
  const displayName = getImageName(image);
  const imageUrl = `${imageBaseUrl}${image.key}/`;
  const STATUS_LABELS: Record<string, string> = {
    added: t('Added'),
    removed: t('Removed'),
    renamed: t('Renamed'),
  };
  const statusLabel = STATUS_LABELS[selectedItem.type] ?? t('Unchanged');

  return (
    <Flex direction="column" gap="0" padding="0" height="100%" width="100%">
      <Flex align="center" gap="md" padding="xl">
        <Text size="lg" bold>
          {displayName}
        </Text>
        <Text variant="muted" size="sm">
          ({statusLabel})
        </Text>
      </Flex>
      <Separator orientation="horizontal" />
      <SingleImageDisplay imageUrl={imageUrl} alt={displayName} />
    </Flex>
  );
}

const ColorInput = styled('input')`
  width: 28px;
  height: 28px;
  cursor: pointer;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.sm};
  padding: 0;
`;
