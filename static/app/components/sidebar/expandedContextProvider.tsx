import {createContext, useState} from 'react';
import {useTheme} from '@emotion/react';

import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useMedia from 'sentry/utils/useMedia';

export const ExpandedContext = createContext<{
  openMainItemId: string | null;
  setOpenMainItem: (mainItemId: string | null) => void;
  shouldAccordionFloat: boolean;
}>({
  openMainItemId: null,
  setOpenMainItem: () => {},
  shouldAccordionFloat: false,
});

export function ExpandedContextProvider(props) {
  const [openMainItemId, setOpenMainItem] = useState<string | null>(null);
  const theme = useTheme();
  const preferences = useLegacyStore(PreferencesStore);
  const horizontal = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const shouldAccordionFloat = horizontal || !!preferences.collapsed;

  return (
    <ExpandedContext.Provider
      value={{openMainItemId, setOpenMainItem, shouldAccordionFloat}}
    >
      {props.children}
    </ExpandedContext.Provider>
  );
}
