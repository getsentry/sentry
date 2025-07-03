import {Fragment} from 'react';
import {t} from 'sentry/locale';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function MCPToolInvocationsWidget() {
  return (
    <Fragment>
      <GenericWidgetEmptyStateWarning
        message={t('MCP Tool Invocations widget coming soon. This will show MCP tool usage and performance metrics.')}
      />
    </Fragment>
  );
}
