import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {TraceLink} from './traceLink';

export const Trace = defineSeerEmbed({
  name: 'trace',
  render(props, level) {
    switch (level) {
      case 'markdown':
        return <TraceLink {...props} format="markdown" />;
      case 'block':
      case 'inline':
        return <TraceLink {...props} />;
    }
  },
});
