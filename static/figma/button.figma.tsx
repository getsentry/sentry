import figma from '@figma/code-connect';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {figmaNodeUrl} from './utils';

figma.connect(Button, figmaNodeUrl('384-2119'), {
  props: {
    size: figma.enum('Size', {
      Zero: 'zero',
      XS: 'xs',
      SM: 'sm',
      MD: 'md',
    }),
    priority: figma.enum('Priority', {
      Default: 'default',
      Primary: 'primary',
      Danger: 'danger',
      Transparent: 'transparent',
      // Warning exists in Figma but not in ButtonProps
    }),
    icon: figma.boolean('Icon'),
    children: figma.boolean('Label'),
    // State props in Figma (Default, Hover, Active, Focused, Disabled)
    // Only disabled affects component behavior, others are CSS states
    // disabled is derived from state=Disabled in Figma
    // No matching props could be found for these Figma properties:
    // state: Hover, Active, Focused handled by CSS
    // Event handlers not available in Figma:
    // onClick, onFocus, onBlur, onMouseEnter, onMouseLeave
    // Accessibility props handled in code:
    // aria-label (required when no children), aria-disabled, aria-busy
    // Advanced props not in Figma:
    // busy, borderless, translucentBorder, title, tooltipProps
    // analyticsEventKey, analyticsEventName, analyticsParams
  } satisfies Partial<ButtonProps>,
  example: props => (
    <Button size={props.size} priority={props.priority} icon={props.icon}>
      {props.children}
    </Button>
  ),
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/button',
    },
  ],
});
