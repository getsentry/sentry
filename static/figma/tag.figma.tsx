import figma from '@figma/code-connect';

import {Tag} from '@sentry/scraps/badge';

import {figmaNodeUrl} from './utils';

figma.connect(Tag, figmaNodeUrl('8277-24598'), {
  props: {
    // Figma Chip component has size (MD/SM/XS) but React Tag doesn't have size prop
    // Tag is a fixed-size component in React
    // No matching props could be found for these Figma properties:
    // size: MD/SM/XS - Tag component has fixed sizing in React
    // Core Tag props not in Figma:
    // type: 'default' | 'success' | 'error' | 'warning' | 'info' | 'promotion' (color variant)
    // icon: React.ReactNode (leading icon)
    // onDismiss: () => void (callback for dismissible tags)
    // onClick: () => void (clickable tags)
    // to, href: string (link tags)
    // children: React.ReactNode (tag content)
  },
  example: () => <Tag>Tag content</Tag>,
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/badge',
    },
  ],
});
