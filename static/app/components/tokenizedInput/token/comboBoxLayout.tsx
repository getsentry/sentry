import {createContext, useContext, type RefObject} from 'react';

export type ComboBoxMenuPresentation = 'floating' | 'panel';

interface ComboBoxLayoutContextData {
  menuPresentation: ComboBoxMenuPresentation;
  panelRef: RefObject<HTMLDivElement | null>;
  portalTarget: HTMLElement | null;
}

const EMPTY_PANEL_REF: RefObject<HTMLDivElement | null> = {current: null};

export const ComboBoxLayoutContext = createContext<ComboBoxLayoutContextData>({
  menuPresentation: 'floating',
  panelRef: EMPTY_PANEL_REF,
  portalTarget: null,
});

export function useComboBoxLayout() {
  return useContext(ComboBoxLayoutContext);
}
