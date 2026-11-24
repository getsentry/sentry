import type {ReactNode} from 'react';

import {Container, Flex, type ContainerProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {lightTheme, type BorderWidthToken} from '@sentry/scraps/theme';

const BORDER_WIDTHS = Object.keys(lightTheme.border) as BorderWidthToken[];

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
    'border widths',
    () => (
      <Gallery>
        {BORDER_WIDTHS.map(width => (
          <Swatch key={width} borderColor="accent.vibrant" borderWidth={width}>
            {width}
          </Swatch>
        ))}
      </Gallery>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'border defaults',
    () => (
      <Gallery>
        <Swatch borderColor="accent.vibrant">color only</Swatch>
        <Swatch borderWidth="xl">width only</Swatch>
        <Swatch borderBottomColor="accent.vibrant" borderWidth="2xl">
          bottom 2xl
        </Swatch>
        <Swatch borderWidth="xl" borderTopColor="danger.vibrant">
          top only
        </Swatch>
      </Gallery>
    ),
    {tags: {area: 'core'}}
  );
});
