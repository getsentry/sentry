import {PlatformIcon} from 'platformicons';

import {Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {PlatformIntegration, PlatformKey} from 'sentry/types/project';

import {ScmCardButton} from './scmCardButton';
import {ScmSelectableContainer} from './scmSelectableContainer';

interface ScmPlatformCardProps {
  isSelected: boolean;
  kind: PlatformIntegration['kind'];
  name: string;
  onClick: () => void;
  platform: PlatformKey;
}

const KIND_LABELS: Record<PlatformIntegration['kind'], string> = {
  language: t('Language'),
  framework: t('Framework'),
  library: t('Library'),
  platform: t('Platform'),
};

export function ScmPlatformCard({
  platform,
  name,
  kind,
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
              {KIND_LABELS[kind]}
            </Text>
          </Stack>
        </Grid>
      </ScmSelectableContainer>
    </ScmCardButton>
  );
}
