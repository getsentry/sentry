import {memo, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Disclosure} from '@sentry/scraps/disclosure';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DiffStatus} from 'sentry/views/preprod/types/snapshotTypes';

interface SidebarGroup {
  count: number;
  key: string;
  name: string;
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
];

const STATUS_META: Record<DiffStatus, {color: PillColor; label: string}> = {
  [DiffStatus.CHANGED]: {color: 'accent', label: t('Changed')},
  [DiffStatus.ADDED]: {color: 'success', label: t('Added')},
  [DiffStatus.REMOVED]: {color: 'danger', label: t('Removed')},
  [DiffStatus.RENAMED]: {color: 'warning', label: t('Renamed')},
  [DiffStatus.UNCHANGED]: {color: 'muted', label: t('Unchanged')},
};

interface SnapshotSidebarContentProps {
  activeStatuses: Set<DiffStatus>;
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
}: SnapshotSidebarContentProps) {
  const hasActiveFilter = activeStatuses.size > 0;
  const isStatusActive = (status: DiffStatus) =>
    !hasActiveFilter || activeStatuses.has(status);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = listRef.current;
    if (!container || !activeItemKey) {
      return;
    }
    const el = container.querySelector<HTMLElement>(
      `[data-item-key="${CSS.escape(activeItemKey)}"]`
    );
    if (!el) {
      return;
    }
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    if (eRect.top < cRect.top) {
      container.scrollTop -= cRect.top - eRect.top;
    } else if (eRect.bottom > cRect.bottom) {
      container.scrollTop += eRect.bottom - cRect.bottom;
    }
  }, [activeItemKey]);

  const [collapsed, setCollapsed] = useState<Set<DiffStatus>>(() => new Set());
  const toggleSection = (type: DiffStatus, expanded: boolean) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const hasGroups = sections.some(s => s.groups.length > 0);

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
      <Stack ref={listRef} overflow="auto" flex="1" paddingRight="0">
        {sections.map(section => {
          if (section.groups.length === 0) {
            return null;
          }
          const sectionType = section.type;
          const meta = sectionType ? STATUS_META[sectionType] : null;
          const isCollapsed = !!sectionType && collapsed.has(sectionType);
          const showHeader = !!meta && !!sectionType && sections.length > 1;
          const items = section.groups.map(group => {
            const isActive = group.key === activeItemKey;
            return (
              <SidebarItemRow
                key={group.key}
                data-item-key={group.key}
                isSelected={isActive}
                indented={showHeader}
                onClick={e => {
                  e.stopPropagation();
                  onSelectItem(group.key);
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
                    {group.name}
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
          if (!showHeader) {
            return <Stack key={sectionType ?? 'solo'}>{items}</Stack>;
          }
          return (
            <SectionDisclosure
              key={sectionType}
              size="xs"
              expanded={!isCollapsed}
              onExpandedChange={expanded => toggleSection(sectionType, expanded)}
            >
              <Disclosure.Title>
                <Flex align="center" gap="sm">
                  <Dot pillColor={meta.color} active />
                  <Text size="sm" bold>
                    {meta.label}
                  </Text>
                </Flex>
              </Disclosure.Title>
              {!isCollapsed && items}
            </SectionDisclosure>
          );
        })}
        {!hasGroups && (
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
