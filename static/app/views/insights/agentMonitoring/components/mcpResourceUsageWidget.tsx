import {Fragment} from 'react';
import {t} from 'sentry/locale';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function MCPResourceUsageWidget() {
  return (
    <Fragment>
      <GenericWidgetEmptyStateWarning
        message={t('MCP Resource Usage widget coming soon. This will show MCP resource access patterns and performance metrics.')}
      />
    </Fragment>
  );
}
