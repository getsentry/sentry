import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import DropdownButton from 'sentry/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {ColorCoding} from 'sentry/types/profiling/core';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';

interface FlamegraphOptionsMenuProps {
  canvasPoolManager: CanvasPoolManager;
  colorCoding: ColorCoding;
  highlightRecursion: boolean;
  onColorCodingChange: (value: ColorCoding) => void;
  onHighlightRecursionChange: (value: boolean) => void;
}

function FlamegraphOptionsMenu({
  canvasPoolManager,
  colorCoding,
  highlightRecursion,
  onColorCodingChange,
  onHighlightRecursionChange,
}: FlamegraphOptionsMenuProps): React.ReactElement {
  return (
    <OptionsMenuContainer>
      <DropdownControl
        button={({isOpen, getActorProps}) => (
          <DropdownButton
            {...getActorProps()}
            isOpen={isOpen}
            prefix={t('Color Coding')}
            size="xsmall"
          >
            {COLOR_CODINGS[colorCoding]}
          </DropdownButton>
        )}
      >
        {Object.entries(COLOR_CODINGS).map(([value, label]) => (
          <DropdownItem
            key={value}
            onSelect={onColorCodingChange}
            eventKey={value}
            isActive={value === colorCoding}
          >
            {label}
          </DropdownItem>
        ))}
      </DropdownControl>
      <Button
        priority={highlightRecursion ? 'primary' : 'default'}
        size="xsmall"
        onClick={() => onHighlightRecursionChange(!highlightRecursion)}
      >
        {t('Highlight Recursion')}
      </Button>
      <Button size="xsmall" onClick={() => canvasPoolManager.dispatch('resetZoom', [])}>
        {t('Reset Zoom')}
      </Button>
    </OptionsMenuContainer>
  );
}

const COLOR_CODINGS: Record<ColorCoding, string> = {
  'by symbol name': t('By Symbol Name'),
  'by library': t('By Library'),
  'by system / application': t('By System / Application'),
};

const OptionsMenuContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
  justify-content: flex-end;
`;

export {FlamegraphOptionsMenu};
