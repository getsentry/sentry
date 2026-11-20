import type {ReactNode} from 'react';

import {Container, Flex, type ContainerProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import type {BorderVariant} from '@sentry/scraps/theme';

const BORDER_COLORS: Array<Exclude<BorderVariant, 'none'>> = [
  'primary',
  'secondary',
  'neutral.muted',
  'neutral.moderate',
  'neutral.vibrant',
  'accent.muted',
  'accent.moderate',
  'accent.vibrant',
  'promotion.muted',
  'promotion.moderate',
  'promotion.vibrant',
  'danger.muted',
  'danger.moderate',
  'danger.vibrant',
  'warning.muted',
  'warning.moderate',
  'warning.vibrant',
  'success.muted',
  'success.moderate',
  'success.vibrant',
  'onVibrant.light',
  'onVibrant.dark',
  'transparent.neutral.muted',
  'transparent.neutral.moderate',
  'transparent.neutral.vibrant',
  'transparent.accent.muted',
  'transparent.accent.moderate',
  'transparent.accent.vibrant',
  'transparent.promotion.muted',
  'transparent.promotion.moderate',
  'transparent.promotion.vibrant',
  'transparent.danger.muted',
  'transparent.danger.moderate',
  'transparent.danger.vibrant',
  'transparent.warning.muted',
  'transparent.warning.moderate',
  'transparent.warning.vibrant',
  'transparent.success.muted',
  'transparent.success.moderate',
  'transparent.success.vibrant',
  'muted',
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
        <Swatch borderColor={{zero: 'primary', md: 'danger'}}>primary → danger</Swatch>
        <Swatch borderBottomColor={{zero: 'primary', md: 'none'}}>bottom → none</Swatch>
      </Flex>
    ),
    width => ({viewport: width, tags: {area: 'core'}})
  );
});
