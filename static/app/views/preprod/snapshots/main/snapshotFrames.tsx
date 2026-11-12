import {useTheme, css} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import {ViewedCheckbox} from './viewedCheckbox';

export function SnapshotCardFrame({
  children,
  fillHeight = false,
  groupName,
}: {
  children: React.ReactNode;
  fillHeight?: boolean;
  groupName?: string | null;
}) {
  return (
    <Stack
      gap="0"
      width="100%"
      background="primary"
      border="primary"
      radius="md"
      overflow="hidden"
      {...(fillHeight ? {flex: '1', minHeight: '0'} : {})}
    >
      {groupName ? <SnapshotGroupHeader name={groupName} /> : null}
      {children}
    </Stack>
  );
}

export function SnapshotGroupHeader({
  name,
  isViewed = false,
  onToggleViewed,
}: {
  name: string;
  isViewed?: boolean | 'indeterminate';
  onToggleViewed?: () => void;
}) {
  return (
    <Flex
      align="center"
      justify="between"
      gap="md"
      padding="lg xl"
      borderBottom={isViewed === true ? undefined : 'secondary'}
      background="primary"
    >
      <Heading as="h3" size="md" ellipsis>
        {name}
      </Heading>
      {onToggleViewed && (
        <ViewedCheckbox
          checked={isViewed}
          onChange={onToggleViewed}
          aria-label={t('All in %s viewed', name)}
        />
      )}
    </Flex>
  );
}

export function SnapshotVariantFrame({
  children,
  fillHeight = false,
  isSelected,
  ...props
}: {
  children: React.ReactNode;
  fillHeight?: boolean;
  isSelected?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  const theme = useTheme();
  return (
    <SnapshotVariantContainer
      position="relative"
      background="primary"
      $fillHeight={fillHeight}
      {...props}
    >
      {children}
      {isSelected ? (
        <SelectedOverlay
          position="absolute"
          inset={0}
          pointerEvents="none"
          style={{
            border: `1px solid ${theme.tokens.border.accent.vibrant}`,
          }}
        />
      ) : null}
    </SnapshotVariantContainer>
  );
}

export function SnapshotCanvasWrapper({children}: {children: React.ReactNode}) {
  return (
    <Container background="secondary" border="primary" radius="sm" overflow="hidden">
      {children}
    </Container>
  );
}

const SelectedOverlay = styled(Container)``;

const SnapshotVariantContainer = styled(Container, {
  shouldForwardProp: prop => prop !== '$fillHeight',
})<{$fillHeight: boolean}>`
  ${p =>
    p.$fillHeight &&
    css`
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-height: 0;
    `}

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;
