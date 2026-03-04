import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import {getImageName} from 'sentry/views/preprod/types/snapshotTypes';
import type {SidebarItem} from 'sentry/views/preprod/types/snapshotTypes';

import {DiffImageDisplay, type DiffMode} from './imageDisplay/diffImageDisplay';
import {SingleImageDisplay} from './imageDisplay/singleImageDisplay';

const OVERLAY_COLORS = [
  '#ff0000',
  '#00cc44',
  '#0088ff',
  '#00cccc',
  '#ff00ff',
  '#ffcc00',
  '#ff6600',
  '#ffffff',
];

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
            <OverlayControls
              showOverlay={showOverlay}
              onShowOverlayChange={onShowOverlayChange}
              overlayColor={overlayColor}
              onOverlayColorChange={onOverlayColorChange}
            />
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

function OverlayControls({
  showOverlay,
  onShowOverlayChange,
  overlayColor,
  onOverlayColorChange,
}: {
  onOverlayColorChange: (color: string) => void;
  onShowOverlayChange: (show: boolean) => void;
  overlayColor: string;
  showOverlay: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(pickerRef, () => setPickerOpen(false));

  return (
    <Flex align="center" gap="sm">
      <Button
        size="xs"
        priority={showOverlay ? 'primary' : 'default'}
        onClick={() => onShowOverlayChange(!showOverlay)}
      >
        {showOverlay ? t('Hide Overlay') : t('Show Overlay')}
      </Button>
      <ColorPickerWrapper ref={pickerRef}>
        <ColorTrigger
          $color={overlayColor}
          onClick={() => setPickerOpen(!pickerOpen)}
          aria-label={t('Pick overlay color')}
        />
        {pickerOpen && (
          <ColorPickerPopover>
            {OVERLAY_COLORS.map(color => (
              <ColorSwatch
                key={color}
                $color={color}
                $selected={overlayColor === color}
                onClick={() => {
                  onOverlayColorChange(color);
                  setPickerOpen(false);
                }}
                aria-label={`Overlay color ${color}`}
              />
            ))}
          </ColorPickerPopover>
        )}
      </ColorPickerWrapper>
    </Flex>
  );
}

const ColorPickerWrapper = styled('div')`
  position: relative;
`;

const ColorTrigger = styled('button')<{$color: string}>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid ${p => p.theme.tokens.border.primary};
  background-color: ${p => p.$color};
  padding: 0;

  &:hover {
    border-color: ${p => p.theme.tokens.border.accent};
  }
`;

const ColorPickerPopover = styled('div')`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  display: flex;
  gap: 6px;
  padding: 8px;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowMedium};
  z-index: ${p => p.theme.zIndex.dropdown};
`;

const ColorSwatch = styled('button')<{$color: string; $selected: boolean}>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid
    ${p => (p.$selected ? p.theme.tokens.border.accent : p.theme.tokens.border.primary)};
  background-color: ${p => p.$color};
  padding: 0;
  outline: ${p => (p.$selected ? `2px solid ${p.theme.tokens.focus.default}` : 'none')};
  outline-offset: 1px;
`;
