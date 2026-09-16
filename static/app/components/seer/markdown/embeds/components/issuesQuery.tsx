import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {IssuesQueryLink} from './issuesQueryLink';

const LazyIssuesQueryBlock = lazy(() => import('./issuesQueryBlock'));

export const IssuesQuery = defineSeerEmbed({
  name: 'issuesQuery',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyIssuesQueryBlock} data={props} />;
    }
    return <IssuesQueryLink {...props} />;
  },
});
