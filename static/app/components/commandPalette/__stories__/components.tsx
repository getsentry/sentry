import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openCommandPaletteDeprecated} from 'sentry/actionCreators/modal';
import {
  makeCommandPaletteCallback,
  makeCommandPaletteGroup,
  makeCommandPaletteLink,
} from 'sentry/components/commandPalette/makeCommandPaletteAction';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {useCommandPaletteActions} from 'sentry/components/commandPalette/useCommandPaletteActions';

export function RegisterActions({actions}: {actions: CommandPaletteAction[]}) {
  useCommandPaletteActions(actions);
  return null;
}

export function CommandPaletteDemo() {
  const demoActions = [
    makeCommandPaletteLink({
      display: {label: 'Go to Flex story'},
      to: '/stories/layout/flex/',
      groupingKey: 'navigate',
    }),
    makeCommandPaletteCallback({
      display: {label: 'Execute an action'},
      groupingKey: 'help',
      onAction: () => {
        addSuccessMessage('Action executed');
      },
    }),
    makeCommandPaletteGroup({
      groupingKey: 'add',
      display: {label: 'Parent action'},
      actions: [
        makeCommandPaletteCallback({
          display: {label: 'Child action'},
          onAction: () => {
            addSuccessMessage('Child action executed');
          },
        }),
      ],
    }),
  ];

  return (
    <Fragment>
      <RegisterActions actions={demoActions} />
      <Button onClick={() => openCommandPaletteDeprecated()}>Open Command Palette</Button>
    </Fragment>
  );
}
