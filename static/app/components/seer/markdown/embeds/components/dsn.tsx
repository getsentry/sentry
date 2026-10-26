import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {TextCopyInput} from 'sentry/components/textCopyInput';

export const Dsn = defineSeerEmbed({
  name: 'dsn',
  render({value}, level) {
    switch (level) {
      case 'markdown':
        // Fenced so a paste target cannot linkify the DSN.
        return `\`${value}\``;
      case 'block':
      case 'inline':
        return <TextCopyInput size="xs">{value}</TextCopyInput>;
    }
  },
});
