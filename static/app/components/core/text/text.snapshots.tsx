import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

describe('Text', () => {
  it.snapshot.each(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const)(
    'size-%s',
    size => <Text size={size}>Text at size {size}</Text>,
    size => ({tags: {size, area: 'core'}})
  );

  it.snapshot.each([
    'primary',
    'muted',
    'accent',
    'success',
    'warning',
    'danger',
    'promotion',
  ] as const)(
    'variant-%s',
    variant => <Text variant={variant}>Text with {variant} variant</Text>,
    variant => ({tags: {variant, area: 'core'}})
  );

  it.snapshot('bold', () => <Text bold>Bold text</Text>, {tags: {area: 'core'}});

  it.snapshot('italic', () => <Text italic>Italic text</Text>, {tags: {area: 'core'}});

  it.snapshot('underline', () => <Text underline>Underlined text</Text>, {
    tags: {area: 'core'},
  });

  it.snapshot(
    'underline-dotted',
    () => <Text underline="dotted">Dotted underlined text</Text>,
    {tags: {area: 'core'}}
  );

  it.snapshot('strikethrough', () => <Text strikethrough>Strikethrough text</Text>, {
    tags: {area: 'core'},
  });

  it.snapshot('uppercase', () => <Text uppercase>Uppercase text</Text>, {
    tags: {area: 'core'},
  });

  it.snapshot('monospace', () => <Text monospace>const x = 1234567890;</Text>, {
    tags: {area: 'core'},
  });

  it.snapshot('tabular', () => <Text tabular>1234567890</Text>, {tags: {area: 'core'}});

  it.snapshot('fraction', () => <Text fraction>1/2 3/4 5/8</Text>, {
    tags: {area: 'core'},
  });

  it.snapshot.each(['left', 'center', 'right', 'justify'] as const)(
    'align-%s',
    align => (
      <div style={{width: 200}}>
        <Text align={align}>
          Aligned text that may wrap to multiple lines for justify demo
        </Text>
      </div>
    ),
    align => ({tags: {align, area: 'core'}})
  );

  it.snapshot.each(['compressed', 'default', 'comfortable', 'fixed'] as const)(
    'density-%s',
    density => (
      <Text as="p" density={density}>
        Text with {density} density. Lorem ipsum dolor sit amet, consectetur adipiscing
        elit.
      </Text>
    ),
    density => ({tags: {density, area: 'core'}})
  );

  it.snapshot(
    'ellipsis',
    () => (
      <div style={{width: 200}}>
        <Text ellipsis>
          This is a very long text that will be truncated with an ellipsis
        </Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'word-break',
    () => (
      <div style={{width: 200}}>
        <Text wordBreak="break-word">
          https://example.com/path/?param1=value1&param2=some-awkward-long-value
        </Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot.each(['balance', 'pretty', 'nowrap', 'stable'] as const)(
    'textWrap-%s',
    textWrap => (
      <div style={{width: 200}}>
        <Text textWrap={textWrap}>Text wrapping demo with a longer string of words</Text>
      </div>
    ),
    textWrap => ({tags: {textWrap, area: 'core'}})
  );

  it.snapshot.each(['nowrap', 'pre', 'pre-line', 'pre-wrap'] as const)(
    'wrap-%s',
    wrap => (
      <div style={{width: 200}}>
        <Text wrap={wrap}>{'Text with\n  whitespace  handling'}</Text>
      </div>
    ),
    wrap => ({tags: {wrap, area: 'core'}})
  );

  // === Combined props ===
  it.snapshot(
    'bold-italic-underline',
    () => (
      <Text bold italic underline>
        Bold italic underlined text
      </Text>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'muted-small-italic',
    () => (
      <Text variant="muted" size="sm" italic>
        Muted small italic text
      </Text>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'danger-bold-uppercase',
    () => (
      <Text variant="danger" bold uppercase>
        Danger bold uppercase text
      </Text>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'monospace-tabular-small',
    () => (
      <Text monospace tabular size="sm">
        42,195.00
      </Text>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'paragraph-in-container',
    () => (
      <Container padding="md" border="primary" width="300px">
        <Text as="p" density="comfortable">
          A paragraph of text inside a bordered container with comfortable line height for
          readable body copy.
        </Text>
      </Container>
    ),
    {tags: {area: 'core'}}
  );
});
