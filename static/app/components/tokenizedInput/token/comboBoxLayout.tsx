import {createContext, useContext, type CSSProperties, type RefObject} from 'react';

export type ComboBoxMenuPresentation = 'floating' | 'panel';

const PANEL_OVERLAY_STYLE: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: '100%',
};

/** Flatten a floating overlay into the unified query-builder panel. */
export function withPanelOverlayProps<T extends {style?: CSSProperties}>(
  overlayProps: T,
  menuPresentation: ComboBoxMenuPresentation
): T {
  if (menuPresentation !== 'panel') {
    return overlayProps;
  }
  return {
    ...overlayProps,
    style: PANEL_OVERLAY_STYLE,
  };
}

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
