import type {ReactNode} from 'react';

import {Container, Flex, type ContainerProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import type {BackgroundVariant, BorderVariant, BorderWidth} from '@sentry/scraps/theme';

const BORDER_COLORS: Array<Exclude<BorderVariant, 'none'>> = [
  'primary',
  'secondary',
  'muted',
  'translucent',
  'accent',
  'danger',
  'warning',
  'success',
  'promotion',
];

const BORDER_WIDTHS: BorderWidth[] = ['md', 'lg', 'xl', '2xl'];

const BACKGROUNDS: BackgroundVariant[] = [
  'primary',
  'secondary',
  'tertiary',
  'translucent',
  'accent',
  'danger',
  'warning',
  'success',
  'promotion',
];

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
          <Swatch key={color} borderColor={color}>
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
        <Swatch borderTopColor="primary">top</Swatch>
        <Swatch borderRightColor="primary">right</Swatch>
        <Swatch borderBottomColor="primary">bottom</Swatch>
        <Swatch borderLeftColor="primary">left</Swatch>
        <Swatch borderColor="primary" borderTopColor="danger">
          danger top
        </Swatch>
        <Swatch borderColor="primary" borderBottomColor="none">
          no bottom
        </Swatch>
      </Gallery>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'border widths',
    () => (
      <Gallery>
        {BORDER_WIDTHS.map(width => (
          <Swatch key={width} borderColor="primary" borderWidth={width}>
            {width}
          </Swatch>
        ))}
        <Swatch borderBottomColor="primary" borderWidth="xl">
          xl bottom
        </Swatch>
      </Gallery>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'backgrounds',
    () => (
      <Gallery>
        {BACKGROUNDS.map(background => (
          <Swatch key={background} background={background}>
            {background}
          </Swatch>
        ))}
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
        <Swatch borderColor={{zero: 'primary', md: 'danger'}} borderWidth="xl">
          primary → danger, xl
        </Swatch>
        <Swatch borderBottomColor={{zero: 'primary', md: 'none'}}>bottom → none</Swatch>
        <Swatch borderColor="primary" borderWidth={{zero: 'md', md: '2xl'}}>
          md → 2xl
        </Swatch>
      </Flex>
    ),
    width => ({viewport: width, tags: {area: 'core'}})
  );
});
