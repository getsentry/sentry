import {ThemeProvider} from '@emotion/react';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {IconEdit} from 'sentry/icons';
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

const allPriorities: Array<ButtonProps['priority']> = [
  'default',
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

    describe.each(allPriorities)('priority %s', priority => {
      describe.each(allSizes)('size %s', size => {
        it.snapshot(
          'without icon',
          () => (
            <Wrapper>
              <Button priority={priority} size={size}>
                Button
              </Button>
            </Wrapper>
          ),
          {theme: themeName, priority: String(priority), size: String(size), icon: 'no'}
        );

        it.snapshot(
          'with icon',
          () => (
            <Wrapper>
              <Button priority={priority} size={size} icon={<IconEdit />}>
                Button
              </Button>
            </Wrapper>
          ),
          {theme: themeName, priority: String(priority), size: String(size), icon: 'yes'}
        );

        it.snapshot(
          'icon-only',
          () => (
            <Wrapper>
              <Button
                priority={priority}
                size={size}
                icon={<IconEdit />}
                aria-label="Edit"
              />
            </Wrapper>
          ),
          {
            theme: themeName,
            priority: String(priority),
            size: String(size),
            icon: 'only',
          }
        );
      });
    });
  });
});
