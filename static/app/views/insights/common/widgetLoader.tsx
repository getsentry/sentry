import {captureException} from '@sentry/core';
import {useQuery} from '@tanstack/react-query';

class WidgetImportError extends Error {
  constructor(options?: ErrorOptions) {
    const message =
      'Error importing widget: (unable to import widget, widget file not found)';
    super(message, options);
    this.name = 'WidgetImportError';
  }
}

class WidgetExportError extends Error {
  constructor(options?: ErrorOptions) {
    const message =
      'Error importing widget: (exported widget not found, widget should be default export)';
    super(message, options);
    this.name = 'WidgetExportError';
  }
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
export function WidgetLoader({id}: {id: string}) {
  const query = useQuery({
    queryKey: [`widget-${id}`],
    queryFn: () => import(`./widgets/${id}`),
  });

  if (query.isPending) {
    return null;
  }

  if (query.isError) {
    const err = new WidgetImportError();
    // eslint-disable-next-line no-console
    console.error(err);
    captureException(err);
    return 'Error loading widget';
  }

  const Component = query.data.default || query.data[Object.keys(query.data)[0] || ''];

  if (!Component) {
    const err = new WidgetExportError();
    // eslint-disable-next-line no-console
    console.error(err);
    captureException(err);
    return 'Error loading widget';
  }

  return <Component />;
}
