import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Disclosure} from '@sentry/scraps/disclosure';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {TagChip} from 'sentry/views/preprod/snapshots/tagChip';
import {useTagFilters} from 'sentry/views/preprod/snapshots/tagFilterContext';
import {DiffStatus} from 'sentry/views/preprod/types/snapshotTypes';

interface SidebarGroup {
  count: number;
  displayName: string;
  key: string;
}

export interface SidebarSection {
  groups: SidebarGroup[];
  type?: DiffStatus;
}

export const DIFF_TYPE_ORDER: Record<string, number> = {
  [DiffStatus.CHANGED]: 0,
  [DiffStatus.REMOVED]: 1,
  [DiffStatus.ADDED]: 2,
  [DiffStatus.RENAMED]: 3,
  [DiffStatus.UNCHANGED]: 4,
  [DiffStatus.SKIPPED]: 5,
};

type StatusCounts = Record<DiffStatus, number>;

type PillColor = 'accent' | 'success' | 'danger' | 'warning' | 'muted';

const STATUS_PILLS: ReadonlyArray<{
  color: PillColor;
  label: string;
  status: DiffStatus;
}> = [
  {status: DiffStatus.CHANGED, color: 'accent', label: t('changed')},
  {status: DiffStatus.REMOVED, color: 'danger', label: t('removed')},
  {status: DiffStatus.ADDED, color: 'success', label: t('added')},
  {status: DiffStatus.RENAMED, color: 'warning', label: t('renamed')},
  {status: DiffStatus.UNCHANGED, color: 'muted', label: t('unchanged')},
  {status: DiffStatus.SKIPPED, color: 'muted', label: t('skipped')},
];

const STATUS_META: Record<DiffStatus, {color: PillColor; label: string}> = {
  [DiffStatus.CHANGED]: {color: 'accent', label: t('Changed')},
  [DiffStatus.ADDED]: {color: 'success', label: t('Added')},
  [DiffStatus.REMOVED]: {color: 'danger', label: t('Removed')},
  [DiffStatus.RENAMED]: {color: 'warning', label: t('Renamed')},
  [DiffStatus.UNCHANGED]: {color: 'muted', label: t('Unchanged')},
  [DiffStatus.SKIPPED]: {color: 'muted', label: t('Skipped')},
};

type VirtualRow =
  | {meta: {color: PillColor; label: string}; sectionType: DiffStatus; type: 'header'}
  | {group: SidebarGroup; indented: boolean; type: 'item'};

const ITEM_HEIGHT = 36;
const SECTION_HEADER_HEIGHT = 28;

interface SnapshotSidebarContentProps {
  activeStatuses: Set<DiffStatus>;
  availableTags: Map<string, Map<string, number>>;
  onSearchChange: (query: string) => void;
  onSelectItem: (itemKey: string) => void;
  onToggleStatus: (status: DiffStatus) => void;
  searchQuery: string;
  sections: SidebarSection[];
  activeItemKey?: string | null;
  statusCounts?: StatusCounts | null;
}

export const SnapshotSidebarContent = memo(function SnapshotSidebarContent({
  sections,
  activeItemKey,
  searchQuery,
  onSearchChange,
  onSelectItem,
  statusCounts,
  activeStatuses,
  onToggleStatus,
  availableTags,
}: SnapshotSidebarContentProps) {
  const hasActiveFilter = activeStatuses.size > 0;
  const isStatusActive = (status: DiffStatus) =>
    !hasActiveFilter || activeStatuses.has(status);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState<Set<DiffStatus>>(() => new Set());
  const toggleSection = useCallback((type: DiffStatus) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const showSectionHeaders = useMemo(
    () => sections.filter(s => s.groups.length > 0).length > 1,
    [sections]
  );

  const virtualRows = useMemo(() => {
    const rows: VirtualRow[] = [];
    for (const section of sections) {
      if (section.groups.length === 0) {
        continue;
      }
      const sectionType = section.type;
      const meta = sectionType ? STATUS_META[sectionType] : null;
      const showHeader = !!sectionType && !!meta && showSectionHeaders;
      if (showHeader) {
        rows.push({type: 'header', sectionType, meta});
        if (!collapsed.has(sectionType)) {
          for (const group of section.groups) {
            rows.push({type: 'item', group, indented: true});
          }
        }
      } else {
        for (const group of section.groups) {
          rows.push({type: 'item', group, indented: false});
        }
      }
    }
    return rows;
  }, [sections, collapsed, showSectionHeaders]);

  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: i =>
      virtualRows[i]!.type === 'header' ? SECTION_HEADER_HEIGHT : ITEM_HEIGHT,
    overscan: 25,
    initialRect: {width: 0, height: 500},
  });

  const prevActiveItemKeyRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!activeItemKey || activeItemKey === prevActiveItemKeyRef.current) {
      prevActiveItemKeyRef.current = activeItemKey;
      return;
    }
    prevActiveItemKeyRef.current = activeItemKey;
    const idx = virtualRows.findIndex(
      r => r.type === 'item' && r.group.key === activeItemKey
    );
    if (idx !== -1) {
      virtualizer.scrollToIndex(idx, {align: 'auto'});
    }
  }, [activeItemKey, virtualRows, virtualizer]);

  const hasGroups = sections.some(s => s.groups.length > 0);
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <Stack height="100%" width="100%">
      <Stack
        gap="xl"
        padding="xl"
        borderBottom="primary"
        onClick={e => e.stopPropagation()}
      >
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
      {availableTags.size > 0 && <TagFilterSection availableTags={availableTags} />}
      <Stack ref={scrollRef} overflow="auto" flex="1" paddingRight="0">
        {hasGroups ? (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualItems.map(vi => {
              const row = virtualRows[vi.index]!;
              return (
                <VirtualRowPositioner
                  key={vi.key}
                  ref={virtualizer.measureElement}
                  data-index={vi.index}
                  style={{transform: `translateY(${vi.start}px)`}}
                >
                  {row.type === 'header' ? (
                    <SectionHeaderRow
                      row={row}
                      expanded={!collapsed.has(row.sectionType)}
                      onToggle={toggleSection}
                    />
                  ) : (
                    <SidebarItem
                      group={row.group}
                      indented={row.indented}
                      isActive={row.group.key === activeItemKey}
                      onSelect={onSelectItem}
                    />
                  )}
                </VirtualRowPositioner>
              );
            })}
          </div>
        ) : (
          <Flex align="center" justify="center" padding="lg">
            <Text variant="muted" size="sm">
              {t('No components found.')}
            </Text>
          </Flex>
        )}
      </Stack>
    </Stack>
  );
});

const SectionHeaderRow = memo(function SectionHeaderRow({
  row,
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: (type: DiffStatus) => void;
  row: Extract<VirtualRow, {type: 'header'}>;
}) {
  return (
    <SectionDisclosure
      size="xs"
      expanded={expanded}
      onExpandedChange={() => onToggle(row.sectionType)}
    >
      <Disclosure.Title>
        <Flex align="center" gap="sm">
          <Dot pillColor={row.meta.color} active />
          <Text size="sm" bold>
            {row.meta.label}
          </Text>
        </Flex>
      </Disclosure.Title>
    </SectionDisclosure>
  );
});

const SidebarItem = memo(function SidebarItem({
  group,
  indented,
  isActive,
  onSelect,
}: {
  group: SidebarGroup;
  indented: boolean;
  isActive: boolean;
  onSelect: (key: string) => void;
}) {
  return (
    <SidebarItemRow
      data-item-key={group.key}
      isSelected={isActive}
      indented={indented}
      onClick={e => {
        e.stopPropagation();
        onSelect(group.key);
      }}
    >
      <Flex align="center" gap="sm" flex="1" minWidth="0">
        <Text
          size="md"
          variant={isActive ? 'accent' : 'muted'}
          bold={isActive}
          ellipsis
          onPointerEnter={setTitleOnOverflow}
        >
          {group.displayName}
        </Text>
      </Flex>
      <CountBadge>
        <Text variant="muted" size="xs">
          {group.count}
        </Text>
      </CountBadge>
    </SidebarItemRow>
  );
});

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

const TagFilterSection = memo(function TagFilterSection({
  availableTags,
}: {
  availableTags: Map<string, Map<string, number>>;
}) {
  const tagFilters = useTagFilters();
  const sortedKeys = useMemo(() => [...availableTags.keys()].sort(), [availableTags]);

  if (!tagFilters) {
    return null;
  }
  const {activeTagFilters, onToggleTagFilter} = tagFilters;
  const hasActiveFilter = Object.keys(activeTagFilters).length > 0;

  return (
    <Stack borderBottom="primary" onClick={e => e.stopPropagation()}>
      <TagDisclosure size="xs">
        <Disclosure.Title>
          <Text size="sm" bold>
            {t('Tags')}
          </Text>
        </Disclosure.Title>
        <Disclosure.Content>
          <Stack gap="lg" paddingBottom="lg" style={{maxHeight: 200, overflowY: 'auto'}}>
            {sortedKeys.map(tagKey => {
              const values = availableTags.get(tagKey)!;
              const activeValue = activeTagFilters[tagKey];
              return (
                <Stack key={tagKey} gap="xs">
                  <Text size="xs" variant="muted" bold>
                    {tagKey}
                  </Text>
                  <Flex gap="xs" wrap="wrap">
                    {[...values.entries()]
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([value, count]) => {
                        const isActive = activeValue === value;
                        const isDisabled = count === 0 && !isActive;
                        return (
                          <TagChip
                            key={value}
                            type="button"
                            isActive={isActive}
                            disabled={isDisabled}
                            onClick={() => onToggleTagFilter(tagKey, value)}
                          >
                            <Text size="xs" variant={isActive ? 'accent' : 'muted'}>
                              {value}
                            </Text>
                            <Text size="xs" variant="muted">
                              {count}
                            </Text>
                          </TagChip>
                        );
                      })}
                  </Flex>
                </Stack>
              );
            })}
          </Stack>
        </Disclosure.Content>
      </TagDisclosure>
      {hasActiveFilter && (
        <Flex gap="xs" wrap="wrap" padding="sm lg">
          {Object.entries(activeTagFilters).map(([key, value]) => (
            <TagChip
              isActive
              key={`${key}:${value}`}
              type="button"
              onClick={() => onToggleTagFilter(key, value)}
            >
              <Text size="xs">
                {key}={value}
              </Text>
              <IconClose size="xs" />
            </TagChip>
          ))}
        </Flex>
      )}
    </Stack>
  );
});

function setTitleOnOverflow(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.title = el.scrollWidth > el.clientWidth ? (el.textContent ?? '') : '';
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

const Dot = styled('span')<{active: boolean; pillColor: PillColor; dotSize?: number}>`
  display: inline-block;
  width: ${p => p.dotSize ?? 6}px;
  height: ${p => p.dotSize ?? 6}px;
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

const SidebarItemRow = styled('div')<{indented: boolean; isSelected: boolean}>`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  padding-left: ${p =>
    p.indented
      ? `calc(${p.theme.space.xl} + 8px + ${p.theme.space.sm})`
      : p.theme.space.xl};
  gap: ${p => p.theme.space.sm};
  cursor: pointer;
  border-right: 3px solid
    ${p => (p.isSelected ? p.theme.tokens.border.accent.vibrant : 'transparent')};
  background: ${p =>
    p.isSelected ? p.theme.tokens.background.transparent.accent.muted : 'transparent'};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const SectionDisclosure = styled(Disclosure)`
  width: 100%;
  align-items: stretch;

  > :first-child {
    padding-right: 0;
    border-radius: 0;

    > button {
      border-radius: 0;
    }
  }
`;

const TagDisclosure = styled(Disclosure)`
  width: 100%;

  > :first-child {
    padding-right: 0;
    border-radius: 0;

    > button {
      border-radius: 0;
    }
  }
`;
const VirtualRowPositioner = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
`;
