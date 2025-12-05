import figma from '@figma/code-connect';

import {Input, type InputProps} from '@sentry/scraps/input';

import {figmaNodeUrl} from './utils';

figma.connect(Input, figmaNodeUrl('3314-9205'), {
  props: {
    size: figma.enum('Size', {
      MD: 'md',
      SM: 'sm',
      XS: 'xs',
    }),
    disabled: figma.boolean('Disabled'),
    // Figma has visual variants for leadingIcon, trailingIcon, trailingButton
    // but React Input doesn't have these props directly
    // Use InputGroup component for leading/trailing items
    // No matching props could be found for these Figma properties:
    // leadingIcon, trailingIcon, trailingButton: Use InputGroup wrapper component
    // state: Focused/Invalid handled by CSS :focus/:invalid pseudo-classes
    // value: boolean - Figma shows filled vs empty, React uses actual value string
    // Core Input props not in Figma:
    // value: string (actual input value)
    // placeholder: string (placeholder text)
    // type: string (text, email, password, etc.)
    // monospace: boolean (monospace font)
    // readOnly: boolean (read-only state)
    // nativeSize: number (character width)
    // Event handlers not in Figma:
    // onChange, onFocus, onBlur, onKeyDown, etc.
  } satisfies Partial<InputProps>,
  example: props => (
    <Input size={props.size} disabled={props.disabled} placeholder="Placeholder" />
  ),
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/input',
    },
  ],
});
