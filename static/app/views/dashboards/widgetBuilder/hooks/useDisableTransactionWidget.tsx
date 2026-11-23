import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

export function useDisableTransactionWidget() {
  const {state} = useWidgetBuilderContext();
  return state.dataset === WidgetType.TRANSACTIONS;
}
