import {
  makeCloseButton,
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';
import {toast} from '@sentry/scraps/toast';

import {
  CMDKAction,
  CommandPaletteProvider,
} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';

export function CommandPaletteDemo() {
  return (
    <CommandPaletteProvider>
      <CMDKAction display={{label: 'Go to Flex story'}} to="/scraps/layout/flex/" />
      <CMDKAction
        display={{label: 'Execute an action'}}
        onAction={() => toast.success('Action executed')}
      />
      <CMDKAction display={{label: 'Parent action'}}>
        <CMDKAction
          display={{label: 'Child action'}}
          onAction={() => toast.success('Child action executed')}
        />
      </CMDKAction>
      <CMDKAction display={{label: 'Issues List'}}>
        <CMDKAction
          display={{label: 'Select all'}}
          onAction={() => toast.success('Select all')}
        />
        <CMDKAction
          display={{label: 'Deselect all'}}
          onAction={() => toast.success('Deselect all')}
        />
      </CMDKAction>
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
