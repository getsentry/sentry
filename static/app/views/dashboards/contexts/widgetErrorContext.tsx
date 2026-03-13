import {createContext, useContext} from 'react';

import type {Widget} from 'sentry/views/dashboards/types';

type WidgetErrorCallback = (widget: Widget, errorMessage: string) => void;

const WidgetErrorContext = createContext<WidgetErrorCallback | null>(null);

export const WidgetErrorProvider = WidgetErrorContext.Provider;

export function useWidgetErrorCallback(): WidgetErrorCallback | null {
  return useContext(WidgetErrorContext);
}
