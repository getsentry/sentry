import queryString from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';

function ReplaysQueryLink({
  query,
  sort,
  title,
  projects,
  environments,
  statsPeriod,
  start,
  end,
}: EmbedOutput<'replaysQuery'>) {
  const organization = useOrganization();
  const href = queryString.stringifyUrl({
    url: makeReplaysPathname({organization, path: '/'}),
    query: {
      query,
      sort,
      project: projects,
      environment: environments,
      statsPeriod,
      start,
      end,
    },
  });

  return <ResourceLink icon={IconPlay} href={href} title={title ?? t('Replay search')} />;
}

export const ReplaysQuery = defineSeerEmbed({
  name: 'replaysQuery',
  render(props) {
    return <ReplaysQueryLink {...props} />;
  },
});
