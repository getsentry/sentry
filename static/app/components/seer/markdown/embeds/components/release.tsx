import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ReleaseBlock} from './releaseBlock';
import {ReleaseLink} from './releaseLink';

export const Release = defineSeerEmbed({
  name: 'release',
  render(props, level) {
    switch (level) {
      case 'block':
        return <ReleaseBlock {...props} />;
      case 'markdown':
        return <ReleaseLink {...props} format="markdown" />;
      case 'inline':
        return <ReleaseLink {...props} />;
    }
  },
});
