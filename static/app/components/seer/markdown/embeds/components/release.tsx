import {ReleaseBlock} from 'sentry/components/seer/markdown/embeds/components/releaseBlock';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ReleaseLink} from './releaseLink';

export const Release = defineSeerEmbed({
  name: 'release',
  render(props, level) {
    return level === 'block' ? <ReleaseBlock {...props} /> : <ReleaseLink {...props} />;
  },
});
