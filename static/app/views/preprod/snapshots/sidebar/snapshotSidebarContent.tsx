import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {parseAsStringEnum, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  IconAdd,
  IconCheckmark,
  IconChevron,
  IconCopy,
  IconEdit,
  IconSearch,
  IconSubtract,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DiffStatus, type SidebarItem} from 'sentry/views/preprod/types/snapshotTypes';

interface SectionConfig {
  defaultExpanded: boolean;
  icon: React.ReactNode;
  label: string;
  type: DiffStatus;
}

export const SECTION_ORDER: SectionConfig[] = [
  {
    type: DiffStatus.CHANGED,
    label: t('Modified'),
    icon: <IconEdit size="xs" />,
    defaultExpanded: true,
  },
  {
    type: DiffStatus.ADDED,
    label: t('Added'),
    icon: <IconAdd size="xs" />,
    defaultExpanded: true,
  },
  {
    type: DiffStatus.REMOVED,
    label: t('Removed'),
    icon: <IconSubtract size="xs" />,
    defaultExpanded: true,
  },
  {
    type: DiffStatus.RENAMED,
    label: t('Renamed'),
    icon: <IconCopy size="xs" />,
    defaultExpanded: true,
  },
  {
    type: DiffStatus.UNCHANGED,
    label: t('Unchanged'),
    icon: <IconCheckmark size="xs" />,
    defaultExpanded: true,
  },
];

interface SnapshotSidebarContentProps {
  currentItemKey: string | null;
  items: SidebarItem[];
  onSearchChange: (query: string) => void;
  onSelectItem: (key: string) => void;
  searchQuery: string;
  totalItemCount: number;
}

export function SnapshotSidebarContent({
  items,
  totalItemCount,
  currentItemKey,
  searchQuery,
  onSearchChange,
  onSelectItem,
}: SnapshotSidebarContentProps) {
  const isDiffMode = items.length > 0 && items[0]!.type !== 'solo';

  const [sectionParam, setSectionParam] = useQueryState(
    'section',
    parseAsStringEnum(Object.values(DiffStatus))
  );

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const s of SECTION_ORDER) {
        initial[s.type] = sectionParam ? s.type === sectionParam : s.defaultExpanded;
      }
      return initial;
    }
  );

  const sectionRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sectionParam) {
      setExpandedSections(prev => ({...prev, [sectionParam]: true}));
    }
  }, [sectionParam]);

  useEffect(() => {
    if (sectionParam && sectionRef.current) {
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
      setSectionParam(null);
    }
  }, [sectionParam, setSectionParam]);

  const groupedItems = useMemo(() => {
    if (!isDiffMode) {
      return null;
    }
    const groups = new Map<string, SidebarItem[]>();
    for (const item of items) {
      const existing = groups.get(item.type);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(item.type, [item]);
      }
    }
    return groups;
  }, [items, isDiffMode]);

  useEffect(() => {
    if (!currentItemKey || !groupedItems) {
      return;
    }
    for (const [sectionType, sectionItems] of groupedItems.entries()) {
      if (sectionItems.some(item => item.key === currentItemKey)) {
        setExpandedSections(prev =>
          prev[sectionType] ? prev : {...prev, [sectionType]: true}
        );
        break;
      }
    }
  }, [currentItemKey, groupedItems]);

  useEffect(() => {
    if (!listRef.current || !currentItemKey) {
      return;
    }
    const el = listRef.current.querySelector(
      `[data-item-name="${CSS.escape(currentItemKey)}"]`
    );
    el?.scrollIntoView({block: 'nearest'});
  }, [currentItemKey]);

  const isSearching = searchQuery.length > 0;

  const handleExpandedChange = (type: string, expanded: boolean) => {
    if (isSearching) return;
    setExpandedSections(prev => ({...prev, [type]: expanded}));
  };

  const isGroupedDiff = isDiffMode && groupedItems !== null;

  const renderItem = (item: SidebarItem) => {
    const isSelected = item.key === currentItemKey;
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
        {item.badge && (
          <Text variant="muted" size="xs">
            {item.badge}
          </Text>
        )}
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
            placeholder={t('Search %s images...', totalItemCount)}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </InputGroup>
      </Stack>
      <Stack ref={listRef} overflow="auto" flex="1" paddingRight="0">
        {isGroupedDiff &&
          SECTION_ORDER.map(section => {
            const sectionItems = groupedItems.get(section.type);
            if (!sectionItems || sectionItems.length === 0) {
              return null;
            }
            const isExpanded = isSearching || expandedSections[section.type];
            return (
              <Disclosure
                key={section.type}
                size="md"
                expanded={isExpanded}
                ref={section.type === sectionParam ? sectionRef : undefined}
              >
                <SidebarSectionTitle
                  priority="transparent"
                  size="md"
                  onClick={() => handleExpandedChange(section.type, !isExpanded)}
                >
                  <Flex align="center" justify="between" width="100%">
                    <Flex align="center" gap="xs">
                      <IconChevron direction={isExpanded ? 'down' : 'right'} size="sm" />
                      <Text size="sm" bold uppercase>
                        {section.label}
                      </Text>
                    </Flex>
                    <Flex align="center" gap="xs">
                      <Text size="sm">{sectionItems.length}</Text>
                      {section.icon}
                    </Flex>
                  </Flex>
                </SidebarSectionTitle>
                {isExpanded && (
                  <SidebarSectionContent>
                    {sectionItems.map(renderItem)}
                  </SidebarSectionContent>
                )}
              </Disclosure>
            );
          })}
        {!isGroupedDiff && items.map(renderItem)}
        {items.length === 0 && (
          <Flex align="center" justify="center" padding="lg">
            <Text variant="muted" size="sm">
              {t('No images found.')}
            </Text>
          </Flex>
        )}
      </Stack>
    </Stack>
  );
}

const SidebarSectionTitle = styled(Button)`
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  display: block;
  width: 100%;
  border-radius: 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const SidebarSectionContent = styled('div')`
  width: 100%;

  &:last-child {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
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
