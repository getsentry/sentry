import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {TextCopyInput} from 'sentry/components/textCopyInput';

export const Dsn = defineSeerEmbed({
  name: 'dsn',
  render({value}, level) {
    switch (level) {
      case 'markdown':
        // The copy button is what the input is for; in text the DSN itself
        // carries that. Fenced so a paste target cannot linkify it.
        return `\`${value}\``;
      case 'block':
      case 'inline':
        return <TextCopyInput size="xs">{value}</TextCopyInput>;
    }
  },
});
