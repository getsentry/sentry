import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';

import {AccentPathSegment} from './accentPathSegment';
import {SOURCE_ROOT_PLACEHOLDER, STACK_ROOT_PLACEHOLDER} from './constants';
import {normalizeRoot} from './normalization';

const PREVIEW_SUFFIX = 'views/index.tsx';

interface PathMappingPreviewProps {
  sourceRoot: string;
  stackRoot: string;
}

export function PathMappingPreview({stackRoot, sourceRoot}: PathMappingPreviewProps) {
  return (
    <Container
      containerType="inline-size"
      background="secondary"
      radius="md"
      padding="xl"
    >
      <Flex
        gap="xl"
        direction={{zero: 'column', '2xs': 'row'}}
        align={{zero: 'stretch', '2xs': 'end'}}
      >
        <Stack gap="sm">
          <Text bold variant="muted">
            {t('In your stack trace')}
          </Text>
          <Text monospace variant="muted" ellipsis>
            <AccentPathSegment
              value={stackRoot || normalizeRoot(STACK_ROOT_PLACEHOLDER)}
            />
            {PREVIEW_SUFFIX}
          </Text>
        </Stack>
        <Flex align="center" display={{zero: 'none', '2xs': 'flex'}}>
          <IconArrow direction="right" />
        </Flex>
        <Stack gap="sm" style={{flex: 1, minWidth: 0}}>
          <Text bold variant="muted">
            {t('Sentry opens in your repo')}
          </Text>
          <Text monospace variant="muted" ellipsis>
            <AccentPathSegment
              value={sourceRoot || normalizeRoot(SOURCE_ROOT_PLACEHOLDER)}
            />
            {PREVIEW_SUFFIX}
          </Text>
        </Stack>
      </Flex>
    </Container>
  );
}
