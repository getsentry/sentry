import {Container} from '@sentry/scraps/layout';

import {ServerTree} from 'sentry/views/insights/pages/platform/nextjs/serverTree';

interface ServerTreeWidgetVisualizationProps {
  noVisualizationPadding?: boolean;
}

export function ServerTreeWidgetVisualization({
  noVisualizationPadding,
}: ServerTreeWidgetVisualizationProps) {
  return (
    <Container overflowY="auto" borderTop="primary" marginTop="lg">
      <ServerTree noVisualizationPadding={noVisualizationPadding} />
    </Container>
  );
}
