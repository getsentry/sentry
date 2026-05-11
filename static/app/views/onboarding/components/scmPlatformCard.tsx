import {PlatformIcon} from 'platformicons';

import {Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getPlatformKind, type PlatformKind} from 'sentry/data/platformKinds';
import {t} from 'sentry/locale';
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

const KIND_LABELS: Record<PlatformKind, string> = {
  language: t('Language'),
  framework: t('Framework'),
  library: t('Library'),
  platform: t('Platform'),
};

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
              {KIND_LABELS[getPlatformKind(platform, type)]}
            </Text>
          </Stack>
        </Grid>
      </ScmSelectableContainer>
    </ScmCardButton>
  );
}
