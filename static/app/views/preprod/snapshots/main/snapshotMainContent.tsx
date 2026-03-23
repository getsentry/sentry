import {useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

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
    const currentPair = selectedItem.pairs[variantIndex];
    if (!currentPair) {
      return null;
    }
    const totalVariants = selectedItem.pairs.length;
    return (
      <Flex direction="column" gap="0" padding="0" height="100%" width="100%">
        <Flex align="center" justify="between" gap="md" padding="xl">
          <Flex align="center" gap="md">
            {totalVariants > 1 && (
              <VariantNavigation
                variantIndex={variantIndex}
                totalVariants={totalVariants}
                onVariantChange={onVariantChange}
              />
            )}
            <Stack gap="md">
              <Flex align="center" gap="md">
                {currentPair.head_image.display_name && (
                  <Text size="lg" bold>
                    {currentPair.head_image.display_name}
                  </Text>
                )}
                {currentPair.head_image.image_file_name && (
                  <InlineCode variant="neutral">
                    {currentPair.head_image.image_file_name}
                  </InlineCode>
                )}
              </Flex>
              {totalVariants > 1 && (
                <Text variant="muted" size="sm">
                  {t('Variant %s / %s', variantIndex + 1, totalVariants)}
                </Text>
              )}
            </Stack>
          </Flex>
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
          pair={currentPair}
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
            <VariantNavigation
              variantIndex={variantIndex}
              totalVariants={totalVariants}
              onVariantChange={onVariantChange}
            />
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

  // added, removed, renamed, unchanged
  const currentImage = selectedItem.images[variantIndex];
  if (!currentImage) {
    return null;
  }
  const displayName = getImageName(currentImage);
  const imageUrl = `${imageBaseUrl}${currentImage.key}/`;
  const totalVariants = selectedItem.images.length;
  const STATUS_LABELS: Record<string, string> = {
    added: t('Added'),
    removed: t('Removed'),
    renamed: t('Renamed'),
  };
  const statusLabel = STATUS_LABELS[selectedItem.type] ?? t('Unchanged');

  return (
    <Flex direction="column" gap="0" padding="0" height="100%" width="100%">
      <Flex align="center" gap="md" padding="xl">
        {totalVariants > 1 && (
          <VariantNavigation
            variantIndex={variantIndex}
            totalVariants={totalVariants}
            onVariantChange={onVariantChange}
          />
        )}
        <Stack gap="md">
          <Flex align="center" gap="md">
            {currentImage.display_name && (
              <Text size="lg" bold>
                {currentImage.display_name}
              </Text>
            )}
            {currentImage.image_file_name &&
              (selectedItem.type === 'renamed' &&
              currentImage.previous_image_file_name ? (
                <Tooltip
                  title={
                    <span>
                      <InlineCode>{currentImage.previous_image_file_name}</InlineCode>
                      {' → '}
                      <InlineCode>{currentImage.image_file_name}</InlineCode>
                    </span>
                  }
                  maxWidth={2000}
                >
                  <InlineCode>{currentImage.image_file_name}</InlineCode>
                </Tooltip>
              ) : (
                <InlineCode variant="neutral">{currentImage.image_file_name}</InlineCode>
              ))}
          </Flex>
          <Flex align="center" gap="sm">
            <Text variant="muted" size="sm">
              ({statusLabel})
            </Text>
            {totalVariants > 1 && (
              <Text variant="muted" size="sm">
                {t('Variant %s / %s', variantIndex + 1, totalVariants)}
              </Text>
            )}
          </Flex>
        </Stack>
      </Flex>
      <Separator orientation="horizontal" />
      <SingleImageDisplay imageUrl={imageUrl} alt={displayName} />
    </Flex>
  );
}

function VariantNavigation({
  variantIndex,
  totalVariants,
  onVariantChange,
}: {
  onVariantChange: (index: number) => void;
  totalVariants: number;
  variantIndex: number;
}) {
  return (
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
  const theme = useTheme();
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const overlayColors = theme.chart.getColorPalette(10);

  useEffect(() => {
    if (!isColorPickerOpen) {
      return undefined;
    }

    function handleMouseDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isColorPickerOpen]);

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
          color={overlayColor}
          aria-label={t('Pick overlay color')}
          onClick={() => setIsColorPickerOpen(open => !open)}
        />
        {isColorPickerOpen && (
          <ColorPickerDropdown>
            <Flex gap="xs">
              {overlayColors.map(color => (
                <ColorSwatch
                  key={color}
                  color={color}
                  selected={overlayColor === color}
                  onClick={() => {
                    onOverlayColorChange(color);
                    setIsColorPickerOpen(false);
                  }}
                  aria-label={t('Overlay color %s', color)}
                />
              ))}
            </Flex>
          </ColorPickerDropdown>
        )}
      </ColorPickerWrapper>
    </Flex>
  );
}

const ColorPickerWrapper = styled('div')`
  position: relative;
`;

const ColorPickerDropdown = styled('div')`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.sm};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  z-index: ${p => p.theme.zIndex.dropdown};
`;

const ColorTrigger = styled('button')<{color: string}>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid ${p => p.theme.tokens.border.primary};
  background-color: ${p => p.color};
  padding: 0;

  &:hover {
    border-color: ${p => p.theme.tokens.border.accent};
  }
`;

const ColorSwatch = styled('button')<{color: string; selected: boolean}>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid
    ${p => (p.selected ? p.theme.tokens.border.accent : p.theme.tokens.border.primary)};
  background-color: ${p => p.color};
  padding: 0;
  outline: ${p => (p.selected ? `2px solid ${p.theme.tokens.focus.default}` : 'none')};
  outline-offset: 1px;
`;
