import {createContext, useContext} from 'react';

import type {useWidgetBuilderState} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

export const WidgetBuilderContext = createContext<
  ReturnType<typeof useWidgetBuilderState> | undefined
>(undefined);

/**
 * Custom hook to get state and dispatch from the WidgetBuilderContext
 */
export const useWidgetBuilderContext = () => {
  const context = useContext(WidgetBuilderContext);
  if (!context) {
    throw new Error(
      'useWidgetBuilderContext must be used within a WidgetBuilderProvider'
    );
  }
  return context;
};
