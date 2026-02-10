import {Container} from '@sentry/scraps/layout';

import {BaseServerTree} from 'sentry/views/insights/pages/platform/nextjs/serverTree';

interface RageAndDeadClicksVisualizationProps {
  noVisualizationPadding?: boolean;
  query?: string;
}

export function RageAndDeadClicksVisualization({
  noVisualizationPadding,
  query,
}: RageAndDeadClicksVisualizationProps) {
  return (
    <Container overflowY="auto" borderTop="primary" marginTop="lg">
      <BaseServerTree noVisualizationPadding={noVisualizationPadding} query={query} />
    </Container>
  );
}
