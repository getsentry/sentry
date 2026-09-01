import {createContext, useContext} from 'react';

interface KeyValueTableContextValue {
  /**
   * `card` renders rows into the two-column subgrid of a card panel. `list`
   * renders them as `table.key-value` rows, which the legacy stylesheet still
   * targets.
   */
  variant: 'card' | 'list';
  isContextData?: boolean;
  raw?: boolean;
}

const KeyValueTableContext = createContext<KeyValueTableContextValue>({
  variant: 'card',
});

export const KeyValueTableContextProvider = KeyValueTableContext.Provider;

export function useKeyValueTableContext() {
  return useContext(KeyValueTableContext);
}
