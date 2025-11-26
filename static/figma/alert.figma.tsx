import figma from '@figma/code-connect';

import {Alert} from '@sentry/scraps/alert';

figma.connect(
  Alert,
  'https://www.figma.com/design/eTJz6aPgudMY9E6mzyZU0B/%F0%9F%90%A6-Components?node-id=6943%3A13522',
  {
    props: {
      // These props were automatically mapped based on your linked code:
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
      expandable: figma.boolean('Expandable'),
    },
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
  }
);
