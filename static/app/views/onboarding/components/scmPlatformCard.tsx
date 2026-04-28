import {PlatformIcon} from 'platformicons';

import {Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {PlatformKey} from 'sentry/types/project';

import {ScmCardButton} from './scmCardButton';
import {ScmSelectableContainer} from './scmSelectableContainer';

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
      <ScmSelectableContainer isSelected={isSelected} padding="lg">
        <Grid gap="md" align="center" columns="max-content min-content">
          <PlatformIcon platform={platform} size={28} />
          <Stack>
            <Text bold textWrap="nowrap">
              {name}
            </Text>
            <Text variant="muted" size="sm" textWrap="nowrap">
              {type}
            </Text>
          </Stack>
        </Grid>
      </ScmSelectableContainer>
    </ScmCardButton>
  );
}
