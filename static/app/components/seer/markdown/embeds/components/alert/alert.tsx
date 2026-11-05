import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {AlertLink} from './alertLink';

const LazyAlertBlock = lazy(() => import('./alertBlock'));

export const Alert = defineSeerEmbed({
  name: 'alert',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazyAlertBlock} {...props} />;
      case 'markdown':
        return <AlertLink {...props} format="markdown" />;
      case 'inline':
        return <AlertLink {...props} />;
    }
  },
});
