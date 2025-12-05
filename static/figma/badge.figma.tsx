import figma from '@figma/code-connect';

import {Badge} from '@sentry/scraps/badge';

import {figmaNodeUrl} from './utils';

// Note: The Figma component at this node is named "Tag" but maps to React "Badge" component
// React has separate Tag component for different use case
figma.connect(Badge, figmaNodeUrl('3574-5396'), {
  props: {
    type: figma.enum('Type', {
      Info: 'default', // Figma doesn't distinguish default/experimental/internal
      Muted: 'default',
      Success: 'new', // React "new" uses green gradient
      Warning: 'warning',
      Danger: 'warning', // Closest match
      Promotion: 'default', // No direct React equivalent
    }),
    // No matching props could be found for these Figma properties:
    // leadingIcon, trailingIcon: Badge component doesn't support icons
    // These are handled by Tag component instead
    // React Badge types not in Figma "Tag":
    // alpha: Has gradient background (pink → yellow)
    // beta: Has gradient background (purple → pink)
    // experimental, internal: Same as default
    // Children prop (label text) not explicitly mapped - comes from layer content
  },
  example: props => <Badge type={props.type}>Label</Badge>,
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/badge',
    },
  ],
});
