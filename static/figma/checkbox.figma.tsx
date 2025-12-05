import figma from '@figma/code-connect';

import {Checkbox} from '@sentry/scraps/checkbox';

import {figmaNodeUrl} from './utils';

figma.connect(Checkbox, figmaNodeUrl('3481-4211'), {
  props: {
    checked: figma.enum('Value', {
      False: false,
      True: true,
      Indeterminate: 'indeterminate',
    }),
    disabled: figma.boolean('Disabled'),
    // Figma has 'focused' boolean prop but React handles focus via :focus-visible
    // Figma has 'state' enum (Default, Hover, Active) but React handles via CSS
    // No matching props could be found for these Figma properties:
    // focused: Handled by :focus-visible CSS pseudo-class
    // state: Hover/Active handled by :hover/:active CSS pseudo-classes
    // Event handlers not available in Figma:
    // onChange, onFocus, onBlur, onClick
    // Size prop exists in React but not in Figma:
    // size?: 'xs' | 'sm' | 'md' (defaults to 'sm')
    // Accessibility props handled in code:
    // aria-label, aria-checked, aria-describedby
  },
  example: props => <Checkbox checked={props.checked} disabled={props.disabled} />,
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/checkbox',
    },
  ],
});
