import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';

import {AccentPathSegment} from './accentPathSegment';

const PREVIEW_SUFFIX = 'views/index.tsx';
const PREVIEW_FILE = 'source.tsx';

interface PathMappingPreviewProps {
  sourceRoot: string;
  stackRoot: string;
}

/**
 * Renders the path segment for one side of the preview.
 * An accent highlight is shown only when the prefix has a value.
 * An empty prefix shows the bare file name with no highlight.
 */
function PreviewSegment({root, file}: {file: string; root: string}) {
  if (root) {
    return (
      <Text monospace variant="muted" ellipsis>
        <AccentPathSegment value={root} />
        {PREVIEW_SUFFIX}
      </Text>
    );
  }
  return (
    <Text monospace variant="muted" ellipsis>
      {file}
    </Text>
  );
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
          <PreviewSegment root={stackRoot} file={PREVIEW_FILE} />
        </Stack>
        <Flex align="center" display={{zero: 'none', '2xs': 'flex'}}>
          <IconArrow direction="right" />
        </Flex>
        <Stack gap="sm" style={{flex: 1, minWidth: 0}}>
          <Text bold variant="muted">
            {t('Sentry opens in your repo')}
          </Text>
          <PreviewSegment root={sourceRoot} file={PREVIEW_FILE} />
        </Stack>
      </Flex>
    </Container>
  );
}
