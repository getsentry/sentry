import {Fragment} from 'react';
import {t} from 'sentry/locale';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export function MCPServersTable() {
  return (
    <Fragment>
      <GenericWidgetEmptyStateWarning
        message={t('MCP Servers table coming soon. This will show connected MCP servers, their status, and performance metrics.')}
      />
    </Fragment>
  );
}
