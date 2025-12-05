import figma from '@figma/code-connect';

import {LinkButton} from 'sentry/components/core/button/linkButton';

import {figmaNodeUrl} from './utils';

// LinkButton uses the same Figma component as Button (384-2119)
// The visual appearance is identical - the difference is navigation behavior
figma.connect(LinkButton, figmaNodeUrl('384-2119'), {
  variant: {
    href: '/path',
  },
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
      // Warning exists in Figma but not in LinkButton
    }),
    icon: figma.boolean('Icon'),
    children: figma.boolean('Label'),
    // LinkButton-specific props not in Figma:
    // to: string | LocationDescriptor (internal navigation)
    // href: string (external navigation)
    // external: boolean (open in new tab for href)
    // replace: boolean (replace history entry)
    // preventScrollReset: boolean (maintain scroll position)
    // disabled: boolean (disable navigation)
    // Event handlers not in Figma:
    // onClick, onFocus, onBlur
    // Accessibility props handled in code:
    // aria-label, role
  },
  example: props => (
    <LinkButton to="/path" size={props.size} priority={props.priority} icon={props.icon}>
      {props.children}
    </LinkButton>
  ),
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/button',
    },
  ],
});
