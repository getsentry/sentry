import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

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

const SECTION_ORDER: SectionConfig[] = [
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
  currentItemName: string | null;
  items: SidebarItem[];
  onSearchChange: (query: string) => void;
  onSelectItem: (name: string) => void;
  searchQuery: string;
  totalItemCount: number;
}

export function SnapshotSidebarContent({
  items,
  totalItemCount,
  currentItemName,
  searchQuery,
  onSearchChange,
  onSelectItem,
}: SnapshotSidebarContentProps) {
  const isDiffMode = items.length > 0 && items[0]!.type !== 'solo';

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const section of SECTION_ORDER) {
        initial[section.type] = section.defaultExpanded;
      }
      return initial;
    }
  );

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

  const isSearching = searchQuery.length > 0;

  const handleExpandedChange = (type: string, expanded: boolean) => {
    if (isSearching) return;
    setExpandedSections(prev => ({...prev, [type]: expanded}));
  };

  const isGroupedDiff = isDiffMode && groupedItems !== null;

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
      <Stack overflow="auto" flex="1" paddingRight="0">
        {isGroupedDiff &&
          SECTION_ORDER.map(section => {
            const sectionItems = groupedItems.get(section.type);
            if (!sectionItems || sectionItems.length === 0) {
              return null;
            }
            const isExpanded = isSearching || expandedSections[section.type];
            return (
              <Disclosure key={section.type} size="md" expanded={isExpanded}>
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
                    {sectionItems.map(item => (
                      <SidebarItemRow
                        key={item.name}
                        isSelected={item.name === currentItemName}
                        onClick={() => onSelectItem(item.name)}
                      >
                        <Flex align="center" gap="sm" flex="1" minWidth="0">
                          <Text
                            size="md"
                            variant={item.name === currentItemName ? 'accent' : 'muted'}
                            bold={item.name === currentItemName}
                            ellipsis
                          >
                            {item.name}
                          </Text>
                        </Flex>
                        {item.type === 'changed' && item.pair.diff !== null && (
                          <Text variant="muted" size="xs">
                            {`${(item.pair.diff * 100).toFixed(1)}%`}
                          </Text>
                        )}
                      </SidebarItemRow>
                    ))}
                  </SidebarSectionContent>
                )}
              </Disclosure>
            );
          })}
        {!isGroupedDiff &&
          items.map(item => {
            const isSelected = item.name === currentItemName;

            return (
              <SidebarItemRow
                key={item.name}
                isSelected={isSelected}
                onClick={() => onSelectItem(item.name)}
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
                {item.type === 'solo' && item.images.length > 1 && (
                  <Text variant="muted" size="xs">
                    {item.images.length}
                  </Text>
                )}
              </SidebarItemRow>
            );
          })}
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
