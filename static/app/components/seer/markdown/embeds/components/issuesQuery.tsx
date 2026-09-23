import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {IssuesQueryLink} from './issuesQueryLink';

const LazyIssuesQueryBlock = lazy(() => import('./issuesQueryBlock'));

export const IssuesQuery = defineSeerEmbed({
  name: 'issuesQuery',
  render(props, level) {
    switch (level) {
      case 'markdown':
        // The preview rows are live data, but the search itself carries over as
        // a link, so a reader can open the same query the block was drawn from.
        return <IssuesQueryLink {...props} format="markdown" />;
      case 'block':
        return <LazyLoad LazyComponent={LazyIssuesQueryBlock} data={props} />;
      case 'inline':
        return <IssuesQueryLink {...props} />;
    }
  },
});
