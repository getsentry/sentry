import {Fragment} from 'react';
import {t} from 'sentry/locale';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export function MCPResourcesTable() {
  return (
    <Fragment>
      <GenericWidgetEmptyStateWarning
        message={t('MCP Resources table coming soon. This will show MCP resources, their access patterns, and performance metrics.')}
      />
    </Fragment>
  );
}
