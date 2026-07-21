import {PlatformIcon} from 'platformicons';

import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getPlatformKind, type PlatformKind} from 'sentry/data/platformKinds';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/platform';

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
        <Flex gap="md" align="center">
          <Flex flexShrink={0}>
            <PlatformIcon platform={platform} size={28} />
          </Flex>
          <Stack maxWidth="100%" flexShrink={1} flexGrow={1} overflow="hidden">
            <InfoText title={name} mode="overflowOnly" bold textWrap="nowrap">
              {name}
            </InfoText>
            <Text variant="muted" size="sm" textWrap="nowrap" ellipsis>
              {KIND_LABELS[getPlatformKind(platform, type)]}
            </Text>
          </Stack>
        </Flex>
      </ScmSelectableContainer>
    </ScmCardButton>
  );
}
