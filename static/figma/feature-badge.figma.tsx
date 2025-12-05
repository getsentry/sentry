import figma from '@figma/code-connect';

import {FeatureBadge} from '@sentry/scraps/badge';

import {figmaNodeUrl} from './utils';

figma.connect(FeatureBadge, figmaNodeUrl('3574-5698'), {
  variant: {
    Type: figma.enum('Type', {
      Alpha: 'alpha',
      Beta: 'beta',
      New: 'new',
      Experimental: 'experimental',
    }),
  },
  props: {
    type: figma.enum('Type', {
      Alpha: 'alpha',
      Beta: 'beta',
      New: 'new',
      Experimental: 'experimental',
    }),
    // No matching props could be found for these Figma properties:
    // variant: Badge/Short/Indicator - FeatureBadge always uses full badge variant
    // React FeatureBadge has fixed labels and styles per type
    // Core FeatureBadge props not in Figma:
    // tooltipProps: Partial<TooltipProps> (customize tooltip)
    // Default tooltip titles are built-in per type:
    // - alpha: "This feature is internal and available for QA purposes"
    // - beta: "This feature is available for early adopters and may change"
    // - new: "This feature is new! Try it out and let us know what you think"
    // - experimental: "This feature is experimental! Try it out..."
  },
  example: props => <FeatureBadge type={props.type} />,
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/badge',
    },
  ],
});
