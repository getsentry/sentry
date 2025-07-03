import {Fragment} from 'react';
import {t} from 'sentry/locale';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function MCPConnectionsWidget() {
  return (
    <Fragment>
      <GenericWidgetEmptyStateWarning
        message={t('MCP Connections widget coming soon. This will show MCP server connections and their performance metrics.')}
      />
    </Fragment>
  );
}
