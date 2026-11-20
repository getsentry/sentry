import type {ReactNode} from 'react';

import {Container, Flex, type ContainerProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {lightTheme, type BorderToken} from '@sentry/scraps/theme';

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

function isBorderToken(path: string): path is BorderToken {
  let node: string | TokenTree | undefined = lightTheme.tokens.border;
  for (const segment of path.split('.')) {
    if (node === undefined || typeof node === 'string') {
      return false;
    }
    node = node[segment];
  }
  return typeof node === 'string';
}

const BORDER_COLORS = tokenPaths(lightTheme.tokens.border).filter(isBorderToken);

function Swatch({children, ...props}: ContainerProps & {children: ReactNode}) {
  return (
    <Container padding="md" radius="md" minWidth="96px" {...props}>
      <Text size="sm">{children}</Text>
    </Container>
  );
}

function Gallery({children}: {children: ReactNode}) {
  return (
    <Flex gap="md" padding="md" wrap="wrap" width="560px" background="primary">
      {children}
    </Flex>
  );
}

describe('Container', () => {
  it.snapshot(
    'border colors',
    () => (
      <Gallery>
        {BORDER_COLORS.map(color => (
          <Swatch key={color} border={color}>
            {color}
          </Swatch>
        ))}
      </Gallery>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'border sides',
    () => (
      <Gallery>
        <Swatch borderTop="primary">top</Swatch>
        <Swatch borderRight="primary">right</Swatch>
        <Swatch borderBottom="primary">bottom</Swatch>
        <Swatch borderLeft="primary">left</Swatch>
        <Swatch border="primary" borderTop="danger.vibrant">
          danger top
        </Swatch>
        <Swatch border="primary" borderBottom="none">
          no bottom
        </Swatch>
      </Gallery>
    ),
    {tags: {area: 'core'}}
  );

  // The container is narrower than `md` (576px) at 480 and wider at 800.
  it.snapshot.each([480, 800])(
    'responsive borders at %s',
    () => (
      <Flex
        containerType="inline-size"
        gap="md"
        padding="md"
        wrap="wrap"
        width="100%"
        background="primary"
      >
        <Swatch border={{zero: 'primary', md: 'danger.vibrant'}}>primary → danger</Swatch>
        <Swatch borderBottom={{zero: 'primary', md: 'none'}}>bottom → none</Swatch>
      </Flex>
    ),
    width => ({viewport: width, tags: {area: 'core'}})
  );
});
