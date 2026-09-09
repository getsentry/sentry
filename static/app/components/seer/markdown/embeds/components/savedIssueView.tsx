import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {SavedIssueViewLink} from './savedIssueViewLink';

const LazySavedIssueViewBlock = lazy(() => import('./savedIssueViewBlock'));

export const SavedIssueView = defineSeerEmbed({
  name: 'savedIssueView',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazySavedIssueViewBlock} {...props} />;
    }
    return <SavedIssueViewLink {...props} />;
  },
});
