import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {TraceLink} from './traceLink';

export const Trace = defineSeerEmbed({
  name: 'trace',
  render(props) {
    return <TraceLink {...props} />;
  },
});
