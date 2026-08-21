import type {CMDKActionData} from 'sentry/components/commandPalette/ui/cmdk/types';
import {makeCollection} from 'sentry/components/commandPalette/ui/collection';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {CommandPaletteStateProvider} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';

export const CMDKCollection = makeCollection<CMDKActionData<any>>();

/**
 * Root provider for the command palette. Wraps the action registrations and UI.
 */
export function CommandPaletteProvider({children}: {children: React.ReactNode}) {
  return (
    <CommandPaletteStateProvider>
      <CommandPaletteSlot.Provider>
        <CMDKCollection.Provider>{children}</CMDKCollection.Provider>
      </CommandPaletteSlot.Provider>
    </CommandPaletteStateProvider>
  );
}
