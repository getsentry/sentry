import {ThemeProvider} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

describe('Text', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    // === Size ===
    it.snapshot.each(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const)('size-%s', size => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text size={size}>Text at size {size}</Text>
        </div>
      </ThemeProvider>
    ));

    // === Variant ===
    it.snapshot.each([
      'primary',
      'muted',
      'accent',
      'success',
      'warning',
      'danger',
      'promotion',
    ] as const)('variant-%s', variant => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text variant={variant}>Text with {variant} variant</Text>
        </div>
      </ThemeProvider>
    ));

    // === Element (as prop) ===
    it.snapshot.each(['span', 'p', 'div', 'label', 'time', 'legend'] as const)(
      'element-%s',
      as => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <Text as={as}>Text rendered as {as}</Text>
          </div>
        </ThemeProvider>
      )
    );

    // === Bold ===
    it.snapshot('bold', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text bold>Bold text</Text>
        </div>
      </ThemeProvider>
    ));

    // === Italic ===
    it.snapshot('italic', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text italic>Italic text</Text>
        </div>
      </ThemeProvider>
    ));

    // === Underline ===
    it.snapshot('underline', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text underline>Underlined text</Text>
        </div>
      </ThemeProvider>
    ));

    it.snapshot('underline-dotted', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text underline="dotted">Dotted underlined text</Text>
        </div>
      </ThemeProvider>
    ));

    // === Strikethrough ===
    it.snapshot('strikethrough', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text strikethrough>Strikethrough text</Text>
        </div>
      </ThemeProvider>
    ));

    // === Uppercase ===
    it.snapshot('uppercase', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text uppercase>Uppercase text</Text>
        </div>
      </ThemeProvider>
    ));

    // === Monospace ===
    it.snapshot('monospace', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text monospace>const x = 1234567890;</Text>
        </div>
      </ThemeProvider>
    ));

    it.snapshot('monospace-bold', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text monospace bold>
            const x = 1234567890;
          </Text>
        </div>
      </ThemeProvider>
    ));

    // === Tabular numbers ===
    it.snapshot('tabular', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text tabular>1234567890</Text>
        </div>
      </ThemeProvider>
    ));

    // === Fraction ===
    it.snapshot('fraction', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text fraction>1/2 3/4 5/8</Text>
        </div>
      </ThemeProvider>
    ));

    // === Tabular + Fraction combined ===
    it.snapshot('tabular-fraction', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text tabular fraction>
            1/2 3/4 5/8
          </Text>
        </div>
      </ThemeProvider>
    ));

    // === Alignment ===
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
      )
    );

    // === Density ===
    it.snapshot.each(['compressed', 'comfortable'] as const)('density-%s', density => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text as="p" density={density}>
            Text with {density} density. Lorem ipsum dolor sit amet, consectetur
            adipiscing elit.
          </Text>
        </div>
      </ThemeProvider>
    ));

    // === Ellipsis ===
    it.snapshot('ellipsis', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8, width: 200}}>
          <Text ellipsis>
            This is a very long text that will be truncated with an ellipsis
          </Text>
        </div>
      </ThemeProvider>
    ));

    // === Word break ===
    it.snapshot('word-break', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8, width: 200}}>
          <Text wordBreak="break-word">
            https://example.com/path/?param1=value1&param2=some-awkward-long-value
          </Text>
        </div>
      </ThemeProvider>
    ));

    // === Text wrap ===
    it.snapshot.each(['balance', 'pretty', 'nowrap', 'stable'] as const)(
      'text-wrap-%s',
      textWrap => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 200}}>
            <Text textWrap={textWrap}>
              Text wrapping demo with a longer string of words
            </Text>
          </div>
        </ThemeProvider>
      )
    );

    // === Wrap (white-space) ===
    it.snapshot.each(['nowrap', 'pre', 'pre-line', 'pre-wrap'] as const)(
      'wrap-%s',
      wrap => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8, width: 200}}>
            <Text wrap={wrap}>{'Text with\n  whitespace  handling'}</Text>
          </div>
        </ThemeProvider>
      )
    );

    // === Cursor ===
    it.snapshot.each(['pointer', 'text', 'not-allowed'] as const)('cursor-%s', cursor => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text cursor={cursor}>Text with {cursor} cursor</Text>
        </div>
      </ThemeProvider>
    ));

    // === Combined props ===
    it.snapshot('bold-italic-underline', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text bold italic underline>
            Bold italic underlined text
          </Text>
        </div>
      </ThemeProvider>
    ));

    it.snapshot('muted-small-italic', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text variant="muted" size="sm" italic>
            Muted small italic text
          </Text>
        </div>
      </ThemeProvider>
    ));

    it.snapshot('danger-bold-uppercase', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text variant="danger" bold uppercase>
            Danger bold uppercase text
          </Text>
        </div>
      </ThemeProvider>
    ));

    it.snapshot('monospace-tabular-small', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text monospace tabular size="sm">
            42,195.00
          </Text>
        </div>
      </ThemeProvider>
    ));

    // === Responsive props ===
    it.snapshot('responsive-size', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text size={{xs: 'xs', sm: 'sm', md: 'md', lg: 'lg', xl: 'xl'}}>
            Responsive sized text
          </Text>
        </div>
      </ThemeProvider>
    ));

    it.snapshot('responsive-align', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8, width: 200}}>
          <Text align={{xs: 'left', md: 'center', xl: 'right'}}>
            Responsive aligned text
          </Text>
        </div>
      </ThemeProvider>
    ));

    it.snapshot('responsive-density', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Text as="p" density={{xs: 'compressed', md: 'comfortable'}}>
            Responsive density text. Lorem ipsum dolor sit amet.
          </Text>
        </div>
      </ThemeProvider>
    ));

    // === Size + density matrix ===
    it.snapshot('size-xl-compressed', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <Flex direction="column" gap="md">
            <Text size="xl" density="compressed">
              XL compressed text
            </Text>
            <Text size="xl" density="comfortable">
              XL comfortable text
            </Text>
          </Flex>
        </div>
      </ThemeProvider>
    ));

    // === Ellipsis with alignment ===
    it.snapshot('ellipsis-center-aligned', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8, width: 200}}>
          <Text ellipsis align="center">
            Centered text that overflows and gets truncated with an ellipsis
          </Text>
        </div>
      </ThemeProvider>
    ));

    // === Paragraph with container ===
    it.snapshot('paragraph-in-container', () => (
      <ThemeProvider theme={themes[themeName]}>
        <Container padding="md" border="primary" width="300px">
          <Text as="p" density="comfortable">
            A paragraph of text inside a bordered container with comfortable line height
            for readable body copy.
          </Text>
        </Container>
      </ThemeProvider>
    ));
  });
});
