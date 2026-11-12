import type React from 'react';

import {useWidgetBuilderState} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

import {WidgetBuilderContext} from './useWidgetBuilderContext';

export {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/useWidgetBuilderContext';

interface WidgetBuilderProviderProps {
  children: React.ReactNode;
}

/**
 * Provider for maintaining a single source of truth for the widget builder state.
 */
function WidgetBuilderStateProvider({children}: WidgetBuilderProviderProps) {
  const widgetBuilderState = useWidgetBuilderState();
  return (
    <WidgetBuilderContext.Provider value={widgetBuilderState}>
      {children}
    </WidgetBuilderContext.Provider>
  );
}

export function WidgetBuilderProvider({children}: WidgetBuilderProviderProps) {
  return <WidgetBuilderStateProvider>{children}</WidgetBuilderStateProvider>;
}
