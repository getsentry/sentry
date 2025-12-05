import figma from '@figma/code-connect';

import {TextArea, type TextAreaProps} from '@sentry/scraps/textarea';

import {figmaNodeUrl} from './utils';

figma.connect(TextArea, figmaNodeUrl('3537-20061'), {
  props: {
    size: figma.enum('Size', {
      MD: 'md',
      SM: 'sm',
      XS: 'xs',
    }),
    disabled: figma.boolean('Disabled'),
    // No matching props could be found for these Figma properties:
    // value: boolean - Figma shows filled vs empty state
    // state: Focused/Invalid handled by CSS :focus/:invalid pseudo-classes
    // Core TextArea props not in Figma:
    // value: string (actual textarea content)
    // placeholder: string (placeholder text)
    // rows: number (initial height)
    // maxRows: number (max height when autosize=true)
    // autosize: boolean (auto-expand based on content)
    // monospace: boolean (monospace font)
    // readOnly: boolean (read-only state)
    // Event handlers not in Figma:
    // onChange, onFocus, onBlur, onKeyDown, etc.
  } satisfies Partial<TextAreaProps>,
  example: props => (
    <TextArea size={props.size} disabled={props.disabled} placeholder="Placeholder" />
  ),
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/textarea',
    },
  ],
});
