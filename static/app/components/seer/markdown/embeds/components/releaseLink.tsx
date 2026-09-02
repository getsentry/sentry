import queryString from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';

export function ReleaseLink({version, projectId}: EmbedOutput<'release'>) {
  const organization = useOrganization();
  const href = queryString.stringifyUrl(
    {
      url: makeReleasesPathname({
        organization,
        path: `/${encodeURIComponent(version)}/`,
      }),
      query: {project: projectId},
    },
    {skipNull: true}
  );

  return (
    <ResourceLink
      icon={IconReleases}
      href={href}
      title={t('Release: %s', formatVersion(version))}
    />
  );
}
