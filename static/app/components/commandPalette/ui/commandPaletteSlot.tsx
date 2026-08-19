import {createContext, useContext} from 'react';

import {slot} from '@sentry/scraps/slot';

const SLOT_NAMES = ['global', 'page', 'task'] as const;
const BaseCommandPaletteSlot = slot(SLOT_NAMES);

export type CommandPaletteSlotName = (typeof SLOT_NAMES)[number];

const CommandPaletteSlotContext = createContext<CommandPaletteSlotName | null>(null);

function CommandPaletteSlotConsumer({
  name,
  children,
}: {
  children: React.ReactNode;
  name: CommandPaletteSlotName;
}) {
  return (
    <CommandPaletteSlotContext value={name}>
      <BaseCommandPaletteSlot name={name}>{children}</BaseCommandPaletteSlot>
    </CommandPaletteSlotContext>
  );
}

export const CommandPaletteSlot = Object.assign(CommandPaletteSlotConsumer, {
  Provider: BaseCommandPaletteSlot.Provider,
  Outlet: BaseCommandPaletteSlot.Outlet,
});

export function useCommandPaletteSlotName() {
  return useContext(CommandPaletteSlotContext);
}
