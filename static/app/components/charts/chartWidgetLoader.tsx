import {captureException} from '@sentry/core';
import {useQuery} from '@tanstack/react-query';

import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

interface Props extends LoadableChartWidgetProps {
  /**
   * ID of the Chart
   */
  id: string;
}

/**
 * Render an Insights Widget by id.
 *
 * This should be the only interface to render widgets because they
 * can be rendered outside of "Insights" (e.g. in the Releases
 * Global Drawer). In the Releases Global Drawer, we need the ability
 * to render a specific widget via URL, which we do by using the
 * widget's `id` prop. In order to maintain the id -> component
 * mapping, we will disallow importing widget components directly and
 * ensure only this component is used.
 */
export function ChartWidgetLoader(props: Props) {
  const query = useQuery<{default: React.FC<LoadableChartWidgetProps>}>({
    queryKey: [`widget-${props.id}`],
    queryFn: () => import(`sentry/views/insights/common/components/widgets/${props.id}`),
  });

  if (query.isPending) {
    return <Placeholder height="100%" />;
  }

  const Component = query.data?.default;

  if (query.isError || !Component) {
    const error =
      query.error ||
      new Error(
        'Unable to import widget: widget file not found or widget not exported as default export.'
      );
    // eslint-disable-next-line no-console
    console.error(error);
    captureException(error);
    return <Placeholder height="100%" error={t('Error loading widget')} />;
  }

  return <Component {...props} />;
}
