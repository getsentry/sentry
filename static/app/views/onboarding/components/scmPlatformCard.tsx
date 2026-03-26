import {PlatformIcon} from 'platformicons';

import {Container, Grid, Stack} from '@sentry/scraps/layout';
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
      <Container border={isSelected ? 'accent' : 'secondary'} padding="lg" radius="md">
        <Grid gap="md" align="center" columns="max-content min-content">
          <PlatformIcon platform={platform} size={28} />
          <Stack gap="0">
            <Text bold textWrap="nowrap">
              {name}
            </Text>
            <Text variant="muted" size="sm" textWrap="nowrap">
              {type}
            </Text>
          </Stack>
        </Grid>
      </Container>
    </ScmCardButton>
  );
}
