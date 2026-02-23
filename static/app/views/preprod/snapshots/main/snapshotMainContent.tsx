import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SnapshotImage} from 'sentry/views/preprod/types/snapshotTypes';

import {SingleImageDisplay} from './imageDisplay/singleImageDisplay';

interface SnapshotMainContentProps {
  currentGroupImages: SnapshotImage[];
  currentGroupKey: string | null;
  onVariantChange: (index: number) => void;
  organizationSlug: string;
  projectSlug: string;
  variantIndex: number;
}

export function SnapshotMainContent({
  currentGroupKey,
  currentGroupImages,
  variantIndex,
  onVariantChange,
  organizationSlug,
  projectSlug,
}: SnapshotMainContentProps) {
  const selectedImage = currentGroupImages[variantIndex];
  if (!currentGroupKey || !selectedImage) {
    return (
      <Flex align="center" justify="center" padding="3xl">
        <Text variant="muted">{t('Select an image from the sidebar.')}</Text>
      </Flex>
    );
  }

  const imageUrl = `/api/0/projects/${organizationSlug}/${projectSlug}/files/images/${selectedImage.key}/`;
  const totalVariants = currentGroupImages.length;

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
            {currentGroupKey}
          </Text>
          {totalVariants > 1 && (
            <Text variant="muted" size="sm">
              {t('Variant %s / %s', variantIndex + 1, totalVariants)}
            </Text>
          )}
        </Stack>
      </Flex>
      <Separator orientation="horizontal" />
      <SingleImageDisplay imageUrl={imageUrl} alt={selectedImage.display_name} />
    </Flex>
  );
}
