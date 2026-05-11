import {ThemeProvider} from '@emotion/react';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {IconEdit} from 'sentry/icons';
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

const allVariants: Array<ButtonProps['variant']> = [
  'secondary',
  'primary',
  'danger',
  'warning',
  'link',
  'transparent',
];

const allSizes: Array<ButtonProps['size']> = ['zero', 'xs', 'sm', 'md'];

describe('Button', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    function Wrapper({children}: {children: React.ReactNode}) {
      return (
        <ThemeProvider theme={themes[themeName]}>
          {/* Buttons need a bit of padding as rootElement.screenshot() clips to the
            element's CSS border-box. For buttons, box-shadows/outlines/focus rings
            extending outside #root get cut off. */}
          <div style={{padding: 8}}>{children}</div>
        </ThemeProvider>
      );
    }

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
            group: `${themeName} – without icon`,
            display_name: `${themeName} / ${variant} / ${size} / without icon`,
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
            group: `${themeName} – with icon`,
            display_name: `${themeName} / ${variant} / ${size} / with icon`,
          }
        );

        it.snapshot(
          'icon-only',
          () => (
            <Wrapper>
              <Button
                variant={variant}
                size={size}
                icon={<IconEdit />}
                aria-label="Edit"
              />
            </Wrapper>
          ),
          {
            group: `${themeName} – icon-only`,
            display_name: `${themeName} / ${variant} / ${size} / icon-only`,
          }
        );
      });
    });
  });
});
