import figma from '@figma/code-connect';

import {Radio, type RadioProps} from '@sentry/scraps/radio';

import {figmaNodeUrl} from './utils';

figma.connect(Radio, figmaNodeUrl('3482-4251'), {
  props: {
    checked: figma.boolean('Checked'),
    disabled: figma.boolean('Disabled'),
    // Figma has 'focused' and 'state' props but React handles these via CSS
    // No matching props could be found for these Figma properties:
    // focused: Handled by :focus-visible CSS pseudo-class
    // state: Hover/Active handled by :hover/:active CSS pseudo-classes
    // Event handlers not available in Figma:
    // onChange, onFocus, onBlur, onClick
    // Size prop exists in React but not in Figma:
    // size?: 'sm' (only one size supported)
    // Accessibility props handled in code:
    // aria-label, role, name, value (for radio groups)
  } satisfies Partial<RadioProps>,
  example: props => <Radio checked={props.checked} disabled={props.disabled} />,
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/radio',
    },
  ],
});
