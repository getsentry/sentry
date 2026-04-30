import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

export function SnapshotCardFrame({
  children,
  groupName,
}: {
  children: React.ReactNode;
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
    >
      {groupName ? <SnapshotGroupHeader name={groupName} /> : null}
      {children}
    </Stack>
  );
}

export function SnapshotGroupHeader({name}: {name: string}) {
  return (
    <Container padding="lg xl" borderBottom="secondary" background="primary">
      <Heading as="h3" size="md">
        {name}
      </Heading>
    </Container>
  );
}

export function SnapshotVariantFrame({
  children,
  isSelected,
  ...props
}: {
  children: React.ReactNode;
  isSelected?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  const theme = useTheme();
  return (
    <SnapshotVariantContainer position="relative" background="primary" {...props}>
      {children}
      {isSelected ? (
        <Container
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

const SnapshotVariantContainer = styled(Container)`
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;
