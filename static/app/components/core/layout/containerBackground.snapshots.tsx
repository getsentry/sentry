import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {lightTheme, type BackgroundToken} from '@sentry/scraps/theme';

type TokenTree = {readonly [key: string]: string | TokenTree};

/**
 * Every leaf path of a token object, e.g. `'transparent.neutral.muted'`.
 */
function tokenPaths(tokens: TokenTree, prefix = ''): string[] {
  return Object.entries(tokens).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : tokenPaths(value, path);
  });
}

function isBackgroundToken(path: string): path is BackgroundToken {
  let node: string | TokenTree | undefined = lightTheme.tokens.background;
  for (const segment of path.split('.')) {
    if (node === undefined || typeof node === 'string') {
      return false;
    }
    node = node[segment];
  }
  return typeof node === 'string';
}

const BACKGROUND_COLORS = tokenPaths(lightTheme.tokens.background).filter(
  isBackgroundToken
);

describe('Container', () => {
  it.snapshot(
    'background colors',
    () => (
      <Flex gap="md" padding="md" wrap="wrap" width="560px" background="primary">
        {BACKGROUND_COLORS.map(color => (
          <Container
            key={color}
            padding="md"
            radius="md"
            minWidth="96px"
            background={color}
            borderColor="primary"
          >
            <Text size="sm">{color}</Text>
          </Container>
        ))}
      </Flex>
    ),
    {tags: {area: 'core'}}
  );
});
