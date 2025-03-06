import {createContext, useState} from 'react';
import {useTheme} from '@emotion/react';

import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useMedia from 'sentry/utils/useMedia';

export const ExpandedContext = createContext<{
  expandedItemId: string | null;
  setExpandedItemId: (mainItemId: string | null) => void;
  shouldAccordionFloat: boolean;
}>({
  expandedItemId: null,
  setExpandedItemId: () => {},
  shouldAccordionFloat: false,
});

// Provides the expanded context to the sidebar accordion when it's in the floating state only (collapsed sidebar or on mobile view)
export function ExpandedContextProvider(props: any) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const theme = useTheme();
  const preferences = useLegacyStore(PreferencesStore);
  const horizontal = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const shouldAccordionFloat = horizontal || !!preferences.collapsed;

  return (
    <ExpandedContext.Provider
      value={{expandedItemId, setExpandedItemId, shouldAccordionFloat}}
    >
      {props.children}
    </ExpandedContext.Provider>
  );
}
