import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

describe('Text', () => {
  it.snapshot.each(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const)(
    'size-%s',
    size => (
      <div style={{padding: 8}}>
        <Text size={size}>Text at size {size}</Text>
      </div>
    ),
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
    variant => (
      <div style={{padding: 8}}>
        <Text variant={variant}>Text with {variant} variant</Text>
      </div>
    ),
    variant => ({tags: {variant, area: 'core'}})
  );

  it.snapshot(
    'bold',
    () => (
      <div style={{padding: 8}}>
        <Text bold>Bold text</Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'italic',
    () => (
      <div style={{padding: 8}}>
        <Text italic>Italic text</Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'underline',
    () => (
      <div style={{padding: 8}}>
        <Text underline>Underlined text</Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'underline-dotted',
    () => (
      <div style={{padding: 8}}>
        <Text underline="dotted">Dotted underlined text</Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'strikethrough',
    () => (
      <div style={{padding: 8}}>
        <Text strikethrough>Strikethrough text</Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'uppercase',
    () => (
      <div style={{padding: 8}}>
        <Text uppercase>Uppercase text</Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'monospace',
    () => (
      <div style={{padding: 8}}>
        <Text monospace>const x = 1234567890;</Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'tabular',
    () => (
      <div style={{padding: 8}}>
        <Text tabular>1234567890</Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'fraction',
    () => (
      <div style={{padding: 8}}>
        <Text fraction>1/2 3/4 5/8</Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot.each(['left', 'center', 'right', 'justify'] as const)(
    'align-%s',
    align => (
      <div style={{padding: 8, width: 200}}>
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
      <div style={{padding: 8}}>
        <Text as="p" density={density}>
          Text with {density} density. Lorem ipsum dolor sit amet, consectetur adipiscing
          elit.
        </Text>
      </div>
    ),
    density => ({tags: {density, area: 'core'}})
  );

  it.snapshot(
    'ellipsis',
    () => (
      <div style={{padding: 8, width: 200}}>
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
      <div style={{padding: 8, width: 200}}>
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
      <div style={{padding: 8, width: 200}}>
        <Text textWrap={textWrap}>Text wrapping demo with a longer string of words</Text>
      </div>
    ),
    textWrap => ({tags: {textWrap, area: 'core'}})
  );

  it.snapshot.each(['nowrap', 'pre', 'pre-line', 'pre-wrap'] as const)(
    'wrap-%s',
    wrap => (
      <div style={{padding: 8, width: 200}}>
        <Text wrap={wrap}>{'Text with\n  whitespace  handling'}</Text>
      </div>
    ),
    wrap => ({tags: {wrap, area: 'core'}})
  );

  // === Combined props ===
  it.snapshot(
    'bold-italic-underline',
    () => (
      <div style={{padding: 8}}>
        <Text bold italic underline>
          Bold italic underlined text
        </Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'muted-small-italic',
    () => (
      <div style={{padding: 8}}>
        <Text variant="muted" size="sm" italic>
          Muted small italic text
        </Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'danger-bold-uppercase',
    () => (
      <div style={{padding: 8}}>
        <Text variant="danger" bold uppercase>
          Danger bold uppercase text
        </Text>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'monospace-tabular-small',
    () => (
      <div style={{padding: 8}}>
        <Text monospace tabular size="sm">
          42,195.00
        </Text>
      </div>
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
