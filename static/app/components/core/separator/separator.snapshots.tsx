import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import type {BorderVariant} from '@sentry/scraps/theme';

const COLORS: BorderVariant[] = ['primary', 'muted', 'translucent', 'accent', 'danger'];

describe('Separator', () => {
  it.snapshot(
    'horizontal',
    () => (
      <Stack gap="md" padding="md" width="320px" background="primary">
        {COLORS.map(color => (
          <Stack key={color} gap="xs">
            <Text size="sm">{color}</Text>
            <Separator orientation="horizontal" borderColor={color} />
          </Stack>
        ))}
      </Stack>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'vertical',
    () => (
      <Flex gap="md" padding="md" height="64px" background="primary">
        {COLORS.map(color => (
          <Flex key={color} gap="sm" align="center">
            <Text size="sm">{color}</Text>
            <Separator orientation="vertical" borderColor={color} />
          </Flex>
        ))}
      </Flex>
    ),
    {tags: {area: 'core'}}
  );
});
