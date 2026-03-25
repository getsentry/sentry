import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import {
  makeCommandPaletteCallback,
  makeCommandPaletteGroup,
  makeCommandPaletteLink,
} from 'sentry/components/commandPalette/makeCommandPaletteAction';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {CommandPaletteContent} from 'sentry/components/commandPalette/ui/content';
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
    <CommandPaletteProvider>
      <RegisterActions actions={demoActions} />
      <CommandPaletteContent onClose={() => {}} />
    </CommandPaletteProvider>
  );
}
