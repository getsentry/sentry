import {useCallback} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import type {
  CommandPaletteAction,
  CommandPaletteActionWithKey,
} from 'sentry/components/commandPalette/types';
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
    (action: Exclude<CommandPaletteActionWithKey, {type: 'group'}>) => {
      if ('to' in action) {
        navigate(normalizeUrl(action.to));
      } else if ('onAction' in action) {
        action.onAction?.();
      }
    },
    [navigate]
  );

  const demoActions = [
    {
      display: {label: 'Go to Flex story'},
      to: '/stories/layout/flex/',
      groupingKey: 'navigate' as const,
    },
    {
      display: {label: 'Execute an action'},
      groupingKey: 'help' as const,
      onAction: () => {
        addSuccessMessage('Action executed');
      },
    },
    {
      groupingKey: 'add' as const,
      display: {label: 'Parent action'},
      actions: [
        {
          display: {label: 'Child action'},
          onAction: () => {
            addSuccessMessage('Child action executed');
          },
        },
      ],
    },
  ];

  return (
    <CommandPaletteProvider>
      <RegisterActions actions={demoActions} />
      <CommandPalette onAction={handleAction} />
    </CommandPaletteProvider>
  );
}
