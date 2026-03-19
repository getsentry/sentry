import type React from 'react';

import {Container} from '@sentry/scraps/layout';

import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {WidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

type WidgetVisualization = React.ComponentType<any> & {
  LoadingPlaceholder: React.ComponentType<any>;
};

export function WidgetVisualizationStates<T extends WidgetVisualization>({
  isLoading,
  isEmpty,
  error,
  emptyMessage,
  VisualizationType,
  visualizationProps,
}: {
  VisualizationType: T;
  error: Error | null;
  isEmpty: boolean;
  isLoading: boolean;
  visualizationProps: React.ComponentProps<T>;
  emptyMessage?: React.ReactNode;
}) {
  if (isLoading) {
    return <VisualizationType.LoadingPlaceholder />;
  }
  if (error) {
    return (
      <Container position="absolute" inset={0}>
        <Widget.WidgetError error={error} />
      </Container>
    );
  }
  if (isEmpty) {
    return emptyMessage ? emptyMessage : <WidgetEmptyStateWarning />;
  }
  return <VisualizationType {...visualizationProps} />;
}
