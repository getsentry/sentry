import figma from '@figma/code-connect';

import {Switch, type SwitchProps} from '@sentry/scraps/switch';

import {figmaNodeUrl} from './utils';

figma.connect(Switch, figmaNodeUrl('3277-4566'), {
  props: {
    size: figma.enum('Size', {
      MD: 'lg',
      SM: 'sm',
    }),
    checked: figma.boolean('Checked'),
    disabled: figma.boolean('Disabled'),
    // Figma has 'focused' and 'state' props but React handles these via CSS
    // No matching props could be found for these Figma properties:
    // focused: Handled by :focus-visible CSS pseudo-class
    // state: Hover/Active handled by :hover/:active CSS pseudo-classes
    // Event handlers not available in Figma:
    // onChange, onFocus, onBlur
    // Accessibility props handled in code:
    // aria-label, aria-checked, role
  } satisfies Partial<SwitchProps>,
  example: props => (
    <Switch size={props.size} checked={props.checked} disabled={props.disabled} />
  ),
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/switch',
    },
  ],
});
