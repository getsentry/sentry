import {SpansQueryBlock} from 'sentry/components/seer/markdown/embeds/components/spansQueryBlock';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {SpansQueryLink} from './spansQueryLink';

export const SpansQuery = defineSeerEmbed({
  name: 'spansQuery',
  render(props, level) {
    return level === 'block' ? (
      <SpansQueryBlock data={props} />
    ) : (
      <SpansQueryLink data={props} />
    );
  },
});
