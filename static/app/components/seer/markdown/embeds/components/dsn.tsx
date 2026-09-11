import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {TextCopyInput} from 'sentry/components/textCopyInput';

export const Dsn = defineSeerEmbed({
  name: 'dsn',
  render({value}) {
    return <TextCopyInput size="xs">{value}</TextCopyInput>;
  },
});
