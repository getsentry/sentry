import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ErrorsQueryLink} from './errorsQueryLink';

const LazyErrorsQueryBlock = lazy(() => import('./errorsQueryBlock'));

export const ErrorsQuery = defineSeerEmbed({
  name: 'errorsQuery',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazyErrorsQueryBlock} data={props} />;
      case 'markdown':
        return <ErrorsQueryLink data={props} format="markdown" />;
      case 'inline':
        return <ErrorsQueryLink data={props} />;
    }
  },
});
