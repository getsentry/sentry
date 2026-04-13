import {useCallback} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/ui/cmdk';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import type {CMDKActionData} from 'sentry/components/commandPalette/ui/cmdk';
import type {CollectionTreeNode} from 'sentry/components/commandPalette/ui/collection';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';

export function CommandPaletteDemo() {
  const navigate = useNavigate();

  const handleAction = useCallback(
    (
      action: CollectionTreeNode<CMDKActionData>,
      _options?: {modifierKeys?: {shiftKey: boolean}}
    ) => {
      if ('to' in action) {
        navigate(normalizeUrl(action.to));
      } else if ('onAction' in action) {
        action.onAction();
      }
    },
    [navigate]
  );

  return (
    <CommandPaletteProvider>
      <CMDKAction display={{label: 'Go to Flex story'}} to="/stories/layout/flex/" />
      <CMDKAction
        display={{label: 'Execute an action'}}
        onAction={() => addSuccessMessage('Action executed')}
      />
      <CMDKAction display={{label: 'Parent action'}}>
        <CMDKAction
          display={{label: 'Child action'}}
          onAction={() => addSuccessMessage('Child action executed')}
        />
      </CMDKAction>
      <CMDKAction display={{label: 'Issues List'}}>
        <CMDKAction
          display={{label: 'Select all'}}
          onAction={() => addSuccessMessage('Select all')}
        />
        <CMDKAction
          display={{label: 'Deselect all'}}
          onAction={() => addSuccessMessage('Deselect all')}
        />
      </CMDKAction>
      <CommandPalette onAction={handleAction} />
    </CommandPaletteProvider>
  );
}
