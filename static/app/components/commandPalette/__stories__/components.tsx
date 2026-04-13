import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  CMDKAction,
  CommandPaletteProvider,
} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';

export function CommandPaletteDemo() {
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
      <CommandPalette />
    </CommandPaletteProvider>
  );
}
