import {useCallback} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import {
  makeCommandPaletteCallback,
  makeCommandPaletteGroup,
  makeCommandPaletteLink,
} from 'sentry/components/commandPalette/makeCommandPaletteAction';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {useCommandPaletteActions} from 'sentry/components/commandPalette/useCommandPaletteActions';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

export function RegisterActions({actions}: {actions: CommandPaletteAction[]}) {
  useCommandPaletteActions(actions);
  return null;
}

export function CommandPaletteDemo() {
  const navigate = useNavigate();

  const handleAction = useCallback(
    (action: CommandPaletteAction) => {
      if ('to' in action) {
        navigate(normalizeUrl(action.to));
      } else if ('onAction' in action) {
        action.onAction();
      }
    },
    [navigate]
  );

  const demoActions: CommandPaletteAction[] = [
    makeCommandPaletteLink({
      display: {label: 'Go to Flex story'},
      to: '/stories/layout/flex/',
    }),
    makeCommandPaletteCallback({
      display: {label: 'Execute an action'},
      onAction: () => {
        addSuccessMessage('Action executed');
      },
    }),
    makeCommandPaletteGroup({
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
      <CommandPalette onAction={handleAction} />
    </CommandPaletteProvider>
  );
}
