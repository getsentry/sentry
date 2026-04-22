import {ThemeProvider} from '@emotion/react';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {IconEdit} from 'sentry/icons';
// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

const themes = {light: lightTheme, dark: darkTheme};

type Permutation = {
  label: string;
  icon?: ButtonProps['icon'];
  priority?: ButtonProps['priority'];
  size?: ButtonProps['size'];
};

const priorities: Permutation[] = [
  {label: 'default', priority: 'default'},
  {label: 'primary', priority: 'primary'},
  {label: 'danger', priority: 'danger'},
  {label: 'warning', priority: 'warning'},
  {label: 'link', priority: 'link'},
  {label: 'transparent', priority: 'transparent'},
];

const sizes: Permutation[] = [
  {label: 'size zero', size: 'zero'},
  {label: 'size xs', size: 'xs'},
  {label: 'size sm', size: 'sm'},
  {label: 'size md', size: 'md'},
];

const sizesWithIcon: Permutation[] = sizes.map(s => ({
  ...s,
  label: `${s.label} with icon`,
  icon: <IconEdit />,
}));

const sizesIconOnly: Permutation[] = sizes.map(s => ({
  ...s,
  label: `${s.label} icon-only`,
  icon: <IconEdit />,
}));

const permutations: Permutation[] = [
  ...priorities,
  ...sizes,
  ...sizesWithIcon,
  ...sizesIconOnly,
];

describe('Button', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot.each<Permutation>(permutations)(
      '$label',
      ({priority, size, icon, label}) => (
        <ThemeProvider theme={themes[themeName]}>
          {/* Buttons need a bit of padding as rootElement.screenshot() clips to the
            element's CSS border-box. For buttons, box-shadows/outlines/focus rings
            extending outside #root get cut off. */}

          <div style={{padding: 8}}>
            {label.includes('icon-only') ? (
              <Button priority={priority} size={size} icon={icon} aria-label="Edit" />
            ) : (
              <Button priority={priority} size={size} icon={icon}>
                {label}
              </Button>
            )}
          </div>
        </ThemeProvider>
      ),
      ({priority, size, icon}) => ({
        theme: themeName,
        ...(priority && {priority}),
        ...(size && {size}),
        icon: icon ? 'yes' : 'no',
      })
    );
  });
});
