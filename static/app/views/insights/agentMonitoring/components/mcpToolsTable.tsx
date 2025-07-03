import {Fragment} from 'react';
import {t} from 'sentry/locale';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export function MCPToolsTable() {
  return (
    <Fragment>
      <GenericWidgetEmptyStateWarning
        message={t('MCP Tools table coming soon. This will show MCP tools, their usage frequency, and performance metrics.')}
      />
    </Fragment>
  );
}
