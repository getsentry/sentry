import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Disclosure} from '@sentry/scraps/disclosure';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  IconAdd,
  IconCheckmark,
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
    defaultExpanded: false,
  },
  {
    type: DiffStatus.REMOVED,
    label: t('Removed'),
    icon: <IconSubtract size="xs" />,
    defaultExpanded: false,
  },
  {
    type: DiffStatus.RENAMED,
    label: t('Renamed'),
    icon: <IconCopy size="xs" />,
    defaultExpanded: false,
  },
  {
    type: DiffStatus.UNCHANGED,
    label: t('Unchanged'),
    icon: <IconCheckmark size="xs" />,
    defaultExpanded: false,
  },
];

interface SnapshotSidebarContentProps {
  currentItemName: string | null;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  items: SidebarItem[];
  onSearchChange: (query: string) => void;
  onSelectItem: (name: string) => void;
  searchQuery: string;
}

export function SnapshotSidebarContent({
  items,
  currentItemName,
  searchQuery,
  onSearchChange,
  onSelectItem,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: SnapshotSidebarContentProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasNextPage) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {threshold: 0}
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isSearching = searchQuery.length > 0;

  const handleExpandedChange = (type: string, expanded: boolean) => {
    if (isSearching) return;
    setExpandedSections(prev => ({...prev, [type]: expanded}));
  };

  const isGroupedDiff = isDiffMode && groupedItems !== null;

  return (
    <Flex direction="column" gap="md" height="100%" width="100%">
      <Flex padding="xl" paddingBottom="0">
        <InputGroup style={{flex: 1}}>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch size="sm" />
          </InputGroup.LeadingItems>
          <InputGroup.Input
            size="sm"
            placeholder={t('Search images...')}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </InputGroup>
      </Flex>
      <Stack overflow="auto" flex="1">
        {isGroupedDiff
          ? SECTION_ORDER.map(section => {
              const sectionItems = groupedItems.get(section.type);
              if (!sectionItems || sectionItems.length === 0) {
                return null;
              }
              const isExpanded = isSearching || expandedSections[section.type];
              return (
                <SectionWrapper key={section.type}>
                  <Disclosure
                    size="xs"
                    expanded={isExpanded}
                    onExpandedChange={expanded =>
                      handleExpandedChange(section.type, expanded)
                    }
                  >
                    <Disclosure.Title
                      trailingItems={
                        <Flex align="center" gap="xs">
                          <Text size="xs" bold>
                            {sectionItems.length}
                          </Text>
                          {section.icon}
                        </Flex>
                      }
                    >
                      <Text size="xs" bold uppercase>
                        {section.label}
                      </Text>
                    </Disclosure.Title>
                    <Disclosure.Content>
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
                    </Disclosure.Content>
                  </Disclosure>
                </SectionWrapper>
              );
            })
          : items.map(item => {
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
        {items.length === 0 && !hasNextPage && !isFetchingNextPage && (
          <Flex align="center" justify="center" padding="lg">
            <Text variant="muted" size="sm">
              {t('No images found.')}
            </Text>
          </Flex>
        )}
        <div ref={loadMoreRef} />
        {isFetchingNextPage && (
          <Flex align="center" justify="center" padding="md">
            <LoadingIndicator size={20} />
          </Flex>
        )}
      </Stack>
    </Flex>
  );
}

const SectionWrapper = styled('div')`
  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }

  [data-disclosure] > :not(:first-child) {
    padding-left: 0;
    padding-right: 0;
  }

  [data-disclosure] > div > button {
    min-width: 0;
    overflow: hidden;
  }

  [data-disclosure] > div > button ~ * {
    flex-shrink: 0;
    padding-right: ${p => p.theme.space.md};
  }
`;

const SidebarItemRow = styled('div')<{isSelected: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  cursor: pointer;
  border-right: 3px solid
    ${p => (p.isSelected ? p.theme.tokens.border.accent.vibrant : 'transparent')};
  background: ${p =>
    p.isSelected ? p.theme.tokens.background.transparent.accent.muted : 'transparent'};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;
