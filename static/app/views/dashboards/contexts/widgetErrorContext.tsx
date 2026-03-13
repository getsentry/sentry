import {createContext, useContext} from 'react';

type WidgetErrorCallback = (widget: {title: string}, errorMessage: string) => void;

const WidgetErrorContext = createContext<WidgetErrorCallback | null>(null);

export const WidgetErrorProvider = WidgetErrorContext.Provider;

export function useWidgetErrorCallback(): WidgetErrorCallback | null {
  return useContext(WidgetErrorContext);
}
