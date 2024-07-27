import {createContext, useContext} from 'react';

/**
 * This is a temporary workaround until react-aria <PopoverContext> passes the value along
 *
 * https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/overlays/src/PortalProvider.tsx
 */
export const PortalContainerContext = createContext<Element>(document.body);

export default function usePortalContainer() {
  return useContext(PortalContainerContext);
}
