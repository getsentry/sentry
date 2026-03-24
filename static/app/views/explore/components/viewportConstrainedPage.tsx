import type {FlexProps} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';

/**
 * A page layout that constrains itself to the viewport height to prevent
 * window-level scrolling. Content within must manage its own overflow
 * (e.g. via scrollable table bodies).
 */
export function ViewportConstrainedPage(props: FlexProps<'main'>) {
  return <Layout.Page maxHeight="100vh" minHeight="0" overflow="hidden" {...props} />;
}
