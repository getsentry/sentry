import queryString from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';

function ReplayLink({id, eventTimestamp}: EmbedOutput<'replay'>) {
  const organization = useOrganization();
  const pathname = makeReplaysPathname({path: `/${id}/`, organization});
  const href = eventTimestamp
    ? queryString.stringifyUrl({url: pathname, query: {event_t: eventTimestamp}})
    : pathname;

  return (
    <ResourceLink
      icon={IconPlay}
      href={href}
      title={t('Replay %s', getShortEventId(id))}
    />
  );
}

export const Replay = defineSeerEmbed({
  name: 'replay',
  render(props) {
    return <ReplayLink {...props} />;
  },
});
