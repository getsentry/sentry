import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import {LegendCheckbox} from './components/legendCheckbox';
import {useOverflowItems} from './useOverflowItems';

export interface LegendItem {
  color: string;
  label: string;
  name: string;
}

interface ChartLegendProps {
  items: LegendItem[];
  onSelectionChange: (selected: Record<string, boolean>) => void;
  selected: Record<string, boolean>;
}

export function ChartLegend({items, selected, onSelectionChange}: ChartLegendProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {overflowItems} = useOverflowItems(containerRef, items);

  const overflowSet = useMemo(
    () => new Set(overflowItems.map(item => item.name)),
    [overflowItems]
  );

  const toggleItem = useCallback(
    (name: string) => {
      onSelectionChange({
        ...selected,
        [name]: selected[name] === false ? true : false,
      });
    },
    [selected, onSelectionChange]
  );

  const overflowOptions: Array<SelectOption<string>> = useMemo(
    () =>
      overflowItems.map(item => ({
        value: item.name,
        label: item.label,
        leadingItems: <ColorDot color={item.color} />,
      })),
    [overflowItems]
  );

  const overflowValues = useMemo(
    () =>
      overflowItems.filter(item => selected[item.name] !== false).map(item => item.name),
    [overflowItems, selected]
  );

  const handleOverflowChange = useCallback(
    (options: Array<{value: string}>) => {
      const selectedSet = new Set(options.map(opt => opt.value));
      const newSelected = {...selected};
      for (const item of overflowItems) {
        newSelected[item.name] = selectedSet.has(item.name);
      }
      onSelectionChange(newSelected);
    },
    [selected, overflowItems, onSelectionChange]
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <Flex align="center" gap="xs" wrap="nowrap">
      <ItemsContainer ref={containerRef} align="center" gap="md" wrap="nowrap">
        {items.map(item => (
          <LegendItemButton
            key={item.name}
            align="center"
            gap="xs"
            style={{
              visibility: overflowSet.has(item.name) ? 'hidden' : 'visible',
            }}
            onClick={() => toggleItem(item.name)}
            role="button"
            aria-label={t('Toggle %s', item.label)}
          >
            <LegendCheckbox
              color={item.color}
              checked={selected[item.name] !== false}
              onChange={e => {
                e.stopPropagation();
                toggleItem(item.name);
              }}
              aria-label={t('Toggle %s', item.label)}
            />
            <Text size="xs" ellipsis>
              {item.label}
            </Text>
          </LegendItemButton>
        ))}
      </ItemsContainer>
      {overflowItems.length > 0 && (
        <CompactSelect
          multiple
          options={overflowOptions}
          value={overflowValues}
          onChange={handleOverflowChange}
          position="bottom-end"
          size="xs"
          trigger={triggerProps => (
            <OverflowTrigger {...triggerProps}>
              {t('%s more', overflowItems.length)}
            </OverflowTrigger>
          )}
        />
      )}
    </Flex>
  );
}

const ItemsContainer = styled(Flex)`
  overflow: hidden;
  min-width: 0;
  flex: 1;
`;

const LegendItemButton = styled(Flex)`
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  user-select: none;

  &:hover {
    opacity: 0.8;
  }
`;

const OverflowTrigger = styled(OverlayTrigger.Button)`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  background: none;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.sm};
  padding: 2px ${p => p.theme.space.sm};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
`;

const ColorDot = styled('div')<{color: string}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${p => p.color};
  flex-shrink: 0;
`;
