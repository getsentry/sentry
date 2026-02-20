import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SnapshotImage} from 'sentry/views/preprod/types/snapshotTypes';

interface SnapshotSidebarContentProps {
  currentGroupName: string | null;
  fetchNextPage: () => Promise<unknown>;
  filteredGroups: Map<string, SnapshotImage[]>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onSearchChange: (query: string) => void;
  onSelectGroupName: (name: string) => void;
  searchQuery: string;
}

export function SnapshotSidebarContent({
  filteredGroups,
  currentGroupName,
  searchQuery,
  onSearchChange,
  onSelectGroupName,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: SnapshotSidebarContentProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

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

  return (
    <Flex direction="column" gap="md" minWidth="300px">
      <Container padding="xl">
        <InputGroup>
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
      </Container>
      <Stack overflow="auto" flex="1">
        {[...filteredGroups.entries()].map(([name, images]) => {
          const isSelected = name === currentGroupName;
          return (
            <SidebarItem
              key={name}
              isSelected={isSelected}
              onClick={() => onSelectGroupName(name)}
            >
              <Text
                size="md"
                variant={isSelected ? 'accent' : 'muted'}
                bold={isSelected}
                ellipsis
              >
                {name}
              </Text>
              <Tag variant="muted">{images.length}</Tag>
            </SidebarItem>
          );
        })}
        {filteredGroups.size === 0 && !hasNextPage && !isFetchingNextPage && (
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

const SidebarItem = styled('div')<{isSelected: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
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
