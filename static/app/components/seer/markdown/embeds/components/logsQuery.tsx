import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {LogsQueryLink} from './logsQueryLink';

const LazyLogsQueryBlock = lazy(() => import('./logsQueryBlock'));

export const LogsQuery = defineSeerEmbed({
  name: 'logsQuery',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazyLogsQueryBlock} data={props} />;
      case 'markdown':
        return <LogsQueryLink data={props} format="markdown" />;
      case 'inline':
        return <LogsQueryLink data={props} />;
    }
  },
});
