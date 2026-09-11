import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {LogsQueryLink} from './logsQueryLink';

const LazyLogsQueryBlock = lazy(() => import('./logsQueryBlock'));

export const LogsQuery = defineSeerEmbed({
  name: 'logsQuery',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyLogsQueryBlock} data={props} />;
    }
    return <LogsQueryLink data={props} />;
  },
});
