import {ThemeProvider} from '@emotion/react';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Text', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot.each(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const)(
      'size-%s',
      size => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text size={size}>Text at size {size}</Text>
          </div>
        </ThemeProvider>
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
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text variant={variant}>Text with {variant} variant</Text>
          </div>
        </ThemeProvider>
      ),
      variant => ({tags: {variant, area: 'core'}})
    );

    it.snapshot(
      'bold',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text bold>Bold text</Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'italic',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text italic>Italic text</Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'underline',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text underline>Underlined text</Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'underline-dotted',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text underline="dotted">Dotted underlined text</Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'strikethrough',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text strikethrough>Strikethrough text</Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'uppercase',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text uppercase>Uppercase text</Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'monospace',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text monospace>const x = 1234567890;</Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'tabular',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text tabular>1234567890</Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'fraction',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text fraction>1/2 3/4 5/8</Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot.each(['left', 'center', 'right', 'justify'] as const)(
      'align-%s',
      align => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 200}}>
            <Text align={align}>
              Aligned text that may wrap to multiple lines for justify demo
            </Text>
          </div>
        </ThemeProvider>
      ),
      align => ({tags: {align, area: 'core'}})
    );

    it.snapshot.each(['compressed', 'comfortable'] as const)(
      'density-%s',
      density => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text as="p" density={density}>
              Text with {density} density. Lorem ipsum dolor sit amet, consectetur
              adipiscing elit.
            </Text>
          </div>
        </ThemeProvider>
      ),
      density => ({tags: {density, area: 'core'}})
    );

    it.snapshot(
      'ellipsis',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 200}}>
            <Text ellipsis>
              This is a very long text that will be truncated with an ellipsis
            </Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'word-break',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 200}}>
            <Text wordBreak="break-word">
              https://example.com/path/?param1=value1&param2=some-awkward-long-value
            </Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot.each(['balance', 'pretty', 'nowrap', 'stable'] as const)(
      'textWrap-%s',
      textWrap => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 200}}>
            <Text textWrap={textWrap}>
              Text wrapping demo with a longer string of words
            </Text>
          </div>
        </ThemeProvider>
      ),
      textWrap => ({tags: {textWrap, area: 'core'}})
    );

    it.snapshot.each(['nowrap', 'pre', 'pre-line', 'pre-wrap'] as const)(
      'wrap-%s',
      wrap => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 200}}>
            <Text wrap={wrap}>{'Text with\n  whitespace  handling'}</Text>
          </div>
        </ThemeProvider>
      ),
      wrap => ({tags: {wrap, area: 'core'}})
    );

    // === Combined props ===
    it.snapshot(
      'bold-italic-underline',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text bold italic underline>
              Bold italic underlined text
            </Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'muted-small-italic',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text variant="muted" size="sm" italic>
              Muted small italic text
            </Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'danger-bold-uppercase',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text variant="danger" bold uppercase>
              Danger bold uppercase text
            </Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'monospace-tabular-small',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text monospace tabular size="sm">
              42,195.00
            </Text>
          </div>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );

    it.snapshot(
      'paragraph-in-container',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <Container padding="md" border="primary" width="300px">
            <Text as="p" density="comfortable">
              A paragraph of text inside a bordered container with comfortable line height
              for readable body copy.
            </Text>
          </Container>
        </ThemeProvider>
      ),
      {tags: {area: 'core'}}
    );
  });
});
