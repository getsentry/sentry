import type React from 'react';

import {MISSING_DATA_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

type WidgetVisualization = React.ComponentType<any> & {
  LoadingPlaceholder: React.ComponentType<any>;
};

export function WidgetVisualizationStates<T extends WidgetVisualization>({
  isLoading,
  isEmpty,
  error,
  VisualizationType,
  visualizationProps,
}: {
  VisualizationType: T;
  error: Error | null;
  isEmpty: boolean;
  isLoading: boolean;
  visualizationProps: React.ComponentProps<T>;
}) {
  if (isLoading) {
    return <VisualizationType.LoadingPlaceholder />;
  }
  if (error) {
    return <Widget.WidgetError error={error} />;
  }
  if (isEmpty) {
    return <Widget.WidgetError error={MISSING_DATA_MESSAGE} />;
  }
  return <VisualizationType {...visualizationProps} />;
}
