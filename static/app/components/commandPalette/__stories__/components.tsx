import {
  makeCloseButton,
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  CMDKAction,
  CommandPaletteProvider,
} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';

export function CommandPaletteDemo() {
  return (
    <CommandPaletteProvider>
      <CMDKAction.Link display={{label: 'Go to Flex story'}} to="/stories/layout/flex/" />
      <CMDKAction.Callback
        display={{label: 'Execute an action'}}
        onAction={() => addSuccessMessage('Action executed')}
      />
      <CMDKAction.Group display={{label: 'Parent action'}}>
        <CMDKAction.Callback
          display={{label: 'Child action'}}
          onAction={() => addSuccessMessage('Child action executed')}
        />
      </CMDKAction.Group>
      <CMDKAction.Group display={{label: 'Issues List'}}>
        <CMDKAction.Callback
          display={{label: 'Select all'}}
          onAction={() => addSuccessMessage('Select all')}
        />
        <CMDKAction.Callback
          display={{label: 'Deselect all'}}
          onAction={() => addSuccessMessage('Deselect all')}
        />
      </CMDKAction.Group>
      <CommandPalette
        Body={ModalBody}
        Footer={ModalFooter}
        Header={makeClosableHeader(() => {})}
        CloseButton={makeCloseButton(() => {})}
        closeModal={() => {}}
      />
    </CommandPaletteProvider>
  );
}
