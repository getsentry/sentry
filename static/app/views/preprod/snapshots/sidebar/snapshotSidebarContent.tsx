import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DiffStatus, type SidebarItem} from 'sentry/views/preprod/types/snapshotTypes';

export const DIFF_TYPE_ORDER: Record<string, number> = {
  [DiffStatus.CHANGED]: 0,
  [DiffStatus.ADDED]: 1,
  [DiffStatus.REMOVED]: 2,
  [DiffStatus.RENAMED]: 3,
  [DiffStatus.UNCHANGED]: 4,
};

type StatusCounts = Record<DiffStatus, number>;

type PillColor = 'accent' | 'success' | 'danger' | 'warning' | 'muted';

const STATUS_PILLS: ReadonlyArray<{
  color: PillColor;
  label: string;
  status: DiffStatus;
}> = [
  {status: DiffStatus.CHANGED, color: 'accent', label: t('modified')},
  {status: DiffStatus.ADDED, color: 'success', label: t('added')},
  {status: DiffStatus.REMOVED, color: 'danger', label: t('removed')},
  {status: DiffStatus.RENAMED, color: 'warning', label: t('renamed')},
  {status: DiffStatus.UNCHANGED, color: 'muted', label: t('unchanged')},
];

interface SnapshotSidebarContentProps {
  activeStatuses: Set<DiffStatus>;
  currentItemKey: string | null;
  isAllSelected: boolean;
  items: SidebarItem[];
  onSearchChange: (query: string) => void;
  onSelectAll: () => void;
  onSelectItem: (key: string) => void;
  onToggleStatus: (status: DiffStatus) => void;
  searchQuery: string;
  totalItemCount: number;
  statusCounts?: StatusCounts | null;
}

export function SnapshotSidebarContent({
  items,
  totalItemCount,
  currentItemKey,
  isAllSelected,
  searchQuery,
  onSearchChange,
  onSelectItem,
  onSelectAll,
  statusCounts,
  activeStatuses,
  onToggleStatus,
}: SnapshotSidebarContentProps) {
  const hasActiveFilter = activeStatuses.size > 0;
  const isStatusActive = (status: DiffStatus) =>
    !hasActiveFilter || activeStatuses.has(status);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current || !currentItemKey || isAllSelected) {
      return;
    }
    const el = listRef.current.querySelector(
      `[data-item-name="${CSS.escape(currentItemKey)}"]`
    );
    el?.scrollIntoView({block: 'nearest'});
  }, [currentItemKey, items, isAllSelected]);

  const renderItem = (item: SidebarItem) => {
    const isSelected = !isAllSelected && item.key === currentItemKey;
    const count =
      item.type === 'changed' || item.type === 'renamed'
        ? item.pairs.length
        : item.images.length;
    return (
      <SidebarItemRow
        key={item.key}
        data-item-name={item.key}
        isSelected={isSelected}
        onClick={() => onSelectItem(item.key)}
      >
        <Flex align="center" gap="sm" flex="1" minWidth="0">
          <Text
            size="md"
            variant={isSelected ? 'accent' : 'muted'}
            bold={isSelected}
            ellipsis
          >
            {item.name}
          </Text>
        </Flex>
        <CountBadge>
          <Text variant="muted" size="xs">
            {count}
          </Text>
        </CountBadge>
      </SidebarItemRow>
    );
  };

  return (
    <Stack height="100%" width="100%">
      <Stack gap="xl" padding="xl" borderBottom="primary">
        <InputGroup style={{flex: 1}}>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch size="sm" />
          </InputGroup.LeadingItems>
          <InputGroup.Input
            size="sm"
            placeholder={t('Search components...')}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </InputGroup>
        {statusCounts && (
          <Flex gap="lg" wrap="wrap">
            {STATUS_PILLS.map(({status, color, label}) => {
              const count = statusCounts[status];
              if (count <= 0) {
                return null;
              }
              return (
                <StatusPill
                  key={status}
                  color={color}
                  count={count}
                  label={label}
                  active={isStatusActive(status)}
                  onClick={() => onToggleStatus(status)}
                />
              );
            })}
          </Flex>
        )}
      </Stack>
      <Stack ref={listRef} overflow="auto" flex="1" paddingRight="0">
        <SidebarItemRow isSelected={isAllSelected} onClick={onSelectAll}>
          <Flex align="center" gap="sm" flex="1" minWidth="0">
            <Text
              size="md"
              variant={isAllSelected ? 'accent' : 'primary'}
              bold={isAllSelected}
              ellipsis
            >
              {t('All')}
            </Text>
          </Flex>
          <CountBadge>
            <Text variant="muted" size="xs">
              {totalItemCount}
            </Text>
          </CountBadge>
        </SidebarItemRow>
        {items.map(renderItem)}
        {items.length === 0 && (
          <Flex align="center" justify="center" padding="lg">
            <Text variant="muted" size="sm">
              {t('No components found.')}
            </Text>
          </Flex>
        )}
      </Stack>
    </Stack>
  );
}

function StatusPill({
  color,
  count,
  label,
  active,
  onClick,
}: {
  active: boolean;
  color: PillColor;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <PillButton type="button" active={active} onClick={onClick}>
      <Dot pillColor={color} active={active} />
      <Text size="xs" variant="muted">
        {count} {label}
      </Text>
    </PillButton>
  );
}

const PillButton = styled('button')<{active: boolean}>`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: ${p => (p.active ? 1 : 0.4)};

  &:hover {
    opacity: ${p => (p.active ? 0.8 : 0.6)};
  }
`;

const Dot = styled('span')<{active: boolean; pillColor: PillColor}>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p => {
    if (!p.active) {
      return p.theme.tokens.content.secondary;
    }
    switch (p.pillColor) {
      case 'accent':
        return p.theme.tokens.graphics.accent.vibrant;
      case 'success':
        return p.theme.tokens.graphics.success.vibrant;
      case 'danger':
        return p.theme.tokens.graphics.danger.vibrant;
      case 'warning':
        return p.theme.tokens.graphics.warning.vibrant;
      case 'muted':
      default:
        return p.theme.tokens.content.secondary;
    }
  }};
`;

const CountBadge = styled('div')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 0 ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.secondary};
`;

const SidebarItemRow = styled('div')<{isSelected: boolean}>`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  gap: ${p => p.theme.space.sm};
  cursor: pointer;
  border-right: 3px solid
    ${p => (p.isSelected ? p.theme.tokens.border.accent.vibrant : 'transparent')};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  background: ${p =>
    p.isSelected ? p.theme.tokens.background.transparent.accent.muted : 'transparent'};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  &:last-child {
    border-bottom: none;
  }
`;
