import {BaseServerTree} from 'sentry/views/insights/pages/platform/nextjs/serverTree';

interface ServerTreeWidgetVisualizationProps {
  query?: string;
}

export function ServerTreeWidgetVisualization({
  query,
}: ServerTreeWidgetVisualizationProps) {
  return <BaseServerTree query={query} />;
}
