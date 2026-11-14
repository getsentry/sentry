import {IconEdit} from '@sentry/icons/edit';

import {Button, type ButtonProps, type ButtonSize} from '@sentry/scraps/button';
import {Container, ContainerQueryContext} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

const allVariants: Array<ButtonProps['variant']> = [
  'secondary',
  'primary',
  'danger',
  'warning',
  'link',
  'transparent',
];

const allSizes: ButtonSize[] = ['zero', 'xs', 'sm', 'md'];

/**
 * Stands in for an avatar stack: bordered circles that are taller than a
 * `zero` button, so the snapshot shows whether the label clips its content.
 */
function OversizedContent() {
  return (
    <span style={{display: 'inline-flex'}}>
      {['#7553ff', '#f1b71c', '#e1567c'].map((color, index) => (
        <span
          key={color}
          style={{
            display: 'inline-block',
            width: 28,
            height: 28,
            marginLeft: index === 0 ? 0 : -8,
            borderRadius: '50%',
            border: '2px solid white',
            background: color,
          }}
        />
      ))}
    </span>
  );
}

describe('Button', () => {
  function Wrapper({children}: {children: React.ReactNode}) {
    // Padding prevents rootElement.screenshot() from clipping shadows and focus rings.
    return <div style={{padding: 8}}>{children}</div>;
  }

  // SSR cannot measure containers, so supply the breakpoint normally set by ResizeObserver.
  it.snapshot.each(['zero', 'lg'] as const)(
    'responsive sizing at %s',
    breakpoint => (
      <Wrapper>
        <ContainerQueryContext value={breakpoint}>
          <Button size={{zero: 'xs', lg: 'sm'}}>Responsive button</Button>
        </ContainerQueryContext>
      </Wrapper>
    ),
    breakpoint => ({tags: {breakpoint, area: 'core'}})
  );

  describe.each(allVariants)('variant %s', variant => {
    describe.each(allSizes)('size %s', size => {
      it.snapshot(
        'without icon',
        () => (
          <Wrapper>
            <Button variant={variant} size={size}>
              Button
            </Button>
          </Wrapper>
        ),
        {
          tags: {variant: String(variant), size: String(size), area: 'core'},
        }
      );

      it.snapshot(
        'with icon',
        () => (
          <Wrapper>
            <Button variant={variant} size={size} icon={<IconEdit />}>
              Button
            </Button>
          </Wrapper>
        ),
        {
          tags: {variant: String(variant), size: String(size), area: 'core'},
        }
      );

      it.snapshot(
        'icon-only',
        () => (
          <Wrapper>
            <Button variant={variant} size={size} icon={<IconEdit />} aria-label="Edit" />
          </Wrapper>
        ),
        {
          tags: {variant: String(variant), size: String(size), area: 'core'},
        }
      );
    });
  });

  // Layout and state behavior that call sites rely on, such as whether the label
  // clips oversized content. Variants differ here, so a diff in these is a
  // regression unless the change means to alter it.
  describe.each(allVariants)('variant %s layout', variant => {
    const tags = {variant: String(variant), area: 'core'} as const;

    it.snapshot(
      'oversized content in a zero button',
      () => (
        <Wrapper>
          <Button variant={variant} size="zero" aria-label="Participants">
            <OversizedContent />
          </Button>
        </Wrapper>
      ),
      {tags}
    );

    it.snapshot(
      'long label in a full-width button',
      () => (
        <Wrapper>
          <Container width="160px">
            <Container width="100%">
              {props => (
                <Button {...props} variant={variant} size="sm" icon={<IconEdit />}>
                  <Container flex="1" minWidth="0">
                    <Text ellipsis align="left">
                      a-project-slug-that-is-too-long-to-fit
                    </Text>
                  </Container>
                </Button>
              )}
            </Container>
          </Container>
        </Wrapper>
      ),
      {tags}
    );

    it.snapshot(
      'short label in a full-width button',
      () => (
        <Wrapper>
          <Container width="240px">
            <Container width="100%">
              {props => (
                <Button {...props} variant={variant} size="sm" icon={<IconEdit />}>
                  Short
                </Button>
              )}
            </Container>
          </Container>
        </Wrapper>
      ),
      {tags}
    );

    it.snapshot(
      'busy',
      () => (
        <Wrapper>
          <Button variant={variant} size="sm" busy>
            Button
          </Button>
        </Wrapper>
      ),
      {tags}
    );

    it.snapshot(
      'disabled',
      () => (
        <Wrapper>
          <Button variant={variant} size="sm" disabled>
            Button
          </Button>
        </Wrapper>
      ),
      {tags}
    );

    it.snapshot(
      'expanded',
      () => (
        <Wrapper>
          <Button variant={variant} size="sm" aria-expanded>
            Button
          </Button>
        </Wrapper>
      ),
      {tags}
    );

    it.snapshot(
      'hover',
      () => (
        <Wrapper>
          <Button variant={variant} size="sm" icon={<IconEdit />}>
            Button
          </Button>
        </Wrapper>
      ),
      {tags, interaction: {hover: 'button'}}
    );

    it.snapshot(
      'active',
      () => (
        <Wrapper>
          <Button variant={variant} size="sm" icon={<IconEdit />}>
            Button
          </Button>
        </Wrapper>
      ),
      {tags, interaction: {active: 'button'}}
    );

    it.snapshot(
      'inline in text',
      () => (
        <Wrapper>
          <Text>
            Before{' '}
            <Button variant={variant} size="zero">
              inline button
            </Button>{' '}
            after.
          </Text>
        </Wrapper>
      ),
      {tags}
    );
  });
});
