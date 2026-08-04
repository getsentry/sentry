import {ToolCall} from '@sentry/scraps/chat';

import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

export const Tool = defineSeerEmbed({
  name: 'tool',
  render(data) {
    return <ToolCall {...data} />;
  },
});
