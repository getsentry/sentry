import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderStateSlice} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

export function useDisableTransactionWidget() {
  const state = useWidgetBuilderStateSlice('dataset');
  const organization = useOrganization();

  return (
    organization.features.includes('discover-saved-queries-deprecation') &&
    state.dataset === WidgetType.TRANSACTIONS
  );
}
