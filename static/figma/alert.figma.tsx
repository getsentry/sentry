import figma from '@figma/code-connect';

import {Alert, type AlertProps} from '@sentry/scraps/alert';

import {figmaNodeUrl} from './utils';

figma.connect(Alert, figmaNodeUrl('3040-309'), {
  props: {
    type: figma.enum('Type', {
      Muted: 'muted',
      Info: 'info',
      Danger: 'error',
      Warning: 'warning',
      Success: 'success',
    }),
    defaultExpanded: figma.boolean('Expandable'),
    showIcon: figma.boolean('Show Button'),
    icon: figma.children('Icon*'),
    system: figma.boolean('System'),
    // No matching props could be found for these Figma properties:
    // "dismissable": figma.boolean('Dismissable'),
    trailingItems: figma.children('Button*'),
    // "showLink": figma.boolean('Show Link'),
  } satisfies AlertProps,
  example: props => (
    <Alert
      type={props.type}
      system={props.system}
      defaultExpanded={props.defaultExpanded}
      trailingItems={props.trailingItems}
      showIcon={props.showIcon}
      icon={props.icon}
    />
  ),
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/alert',
    },
  ],
});
