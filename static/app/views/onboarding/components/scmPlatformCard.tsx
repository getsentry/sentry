import {PlatformIcon} from 'platformicons';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {PlatformKey} from 'sentry/types/project';

import {ScmCardButton} from './scmCardButton';

interface ScmPlatformCardProps {
  isSelected: boolean;
  name: string;
  onClick: () => void;
  platform: PlatformKey;
  type: string;
}

export function ScmPlatformCard({
  platform,
  name,
  type,
  isSelected,
  onClick,
}: ScmPlatformCardProps) {
  return (
    <ScmCardButton onClick={onClick} role="radio" aria-checked={isSelected}>
      <Container border={isSelected ? 'accent' : 'secondary'} padding="md lg" radius="md">
        <Flex gap="md" align="center">
          <PlatformIcon platform={platform} size={28} />
          <Stack gap="0">
            <Text bold>{name}</Text>
            <Text variant="muted" size="sm">
              {type}
            </Text>
          </Stack>
        </Flex>
      </Container>
    </ScmCardButton>
  );
}
