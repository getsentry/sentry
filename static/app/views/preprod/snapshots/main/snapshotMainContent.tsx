import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SidebarItem} from 'sentry/views/preprod/types/snapshotTypes';

import {DiffImageDisplay} from './imageDisplay/diffImageDisplay';
import {SingleImageDisplay} from './imageDisplay/singleImageDisplay';

interface SnapshotMainContentProps {
  diffImageBaseUrl: string;
  imageBaseUrl: string;
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
  overlayColor,
}: SnapshotMainContentProps) {
  if (!selectedItem) {
    return (
      <Flex align="center" justify="center" padding="3xl" width="100%">
        <Text variant="muted">{t('Select an image from the sidebar.')}</Text>
      </Flex>
    );
  }

  if (selectedItem.type === 'changed') {
    const displayName =
      selectedItem.pair.head_image.display_name ??
      selectedItem.pair.head_image.image_file_name;
    return (
      <Flex direction="column" gap="0" padding="0" height="100%" width="100%">
        <Flex align="center" gap="md" padding="xl">
          <Text size="lg" bold>
            {displayName}
          </Text>
        </Flex>
        <Separator orientation="horizontal" />
        <DiffImageDisplay
          pair={selectedItem.pair}
          imageBaseUrl={imageBaseUrl}
          diffImageBaseUrl={diffImageBaseUrl}
          showOverlay={showOverlay}
          overlayColor={overlayColor}
        />
      </Flex>
    );
  }

  if (selectedItem.type === 'solo') {
    const currentImage = selectedItem.images[variantIndex];
    if (!currentImage) {
      return null;
    }
    const displayName = currentImage.display_name ?? currentImage.image_file_name;
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
  const displayName = image.display_name ?? image.image_file_name;
  const imageUrl = `${imageBaseUrl}${image.key}/`;
  const statusLabel =
    selectedItem.type === 'added'
      ? t('Added')
      : selectedItem.type === 'removed'
        ? t('Removed')
        : selectedItem.type === 'renamed'
          ? t('Renamed')
          : t('Unchanged');

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
