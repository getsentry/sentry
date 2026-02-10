import {Container} from '@sentry/scraps/layout';

import {BaseServerTree} from 'sentry/views/insights/pages/platform/nextjs/serverTree';

interface ServerTreeWidgetVisualizationProps {
  noVisualizationPadding?: boolean;
  query?: string;
}

export function ServerTreeWidgetVisualization({
  noVisualizationPadding,
  query,
}: ServerTreeWidgetVisualizationProps) {
  return (
    <Container overflowY="auto" borderTop="primary" marginTop="lg">
      <BaseServerTree noVisualizationPadding={noVisualizationPadding} query={query} />
    </Container>
  );
}
