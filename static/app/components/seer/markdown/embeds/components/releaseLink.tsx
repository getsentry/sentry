import queryString from 'query-string';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';

export function getReleaseHref(
  {version, projectId}: Pick<EmbedOutput<'release'>, 'version' | 'projectId'>,
  organization: Organization
): string {
  return queryString.stringifyUrl(
    {
      url: makeReleasesPathname({
        organization,
        path: `/${encodeURIComponent(version)}/`,
      }),
      query: {project: projectId},
    },
    {skipNull: true}
  );
}

export function ReleaseLink(props: EmbedOutput<'release'>) {
  const organization = useOrganization();

  return (
    <ResourceLink
      icon={IconReleases}
      href={getReleaseHref(props, organization)}
      title={t('Release: %s', formatVersion(props.version))}
    />
  );
}
