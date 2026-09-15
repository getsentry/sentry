import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {ProfileLink} from 'sentry/components/seer/markdown/embeds/components/profile/profileLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

const LazyProfileBlock = lazy(() => import('./profileBlock'));

export const Profile = defineSeerEmbed({
  name: 'profile',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyProfileBlock} {...props} />;
    }
    return <ProfileLink {...props} />;
  },
});
