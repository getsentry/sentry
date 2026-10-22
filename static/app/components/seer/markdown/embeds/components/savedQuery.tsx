import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {SavedQueryLink} from './savedQueryLink';

const LazySavedQueryBlock = lazy(() => import('./savedQueryBlock'));

export const SavedQuery = defineSeerEmbed({
  name: 'savedQuery',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazySavedQueryBlock} data={props} />;
      case 'markdown':
        return <SavedQueryLink data={props} format="markdown" />;
      case 'inline':
        return <SavedQueryLink data={props} />;
    }
  },
});
