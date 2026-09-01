import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

function ProfileLink({projectSlug, profileId}: EmbedOutput<'profile'>) {
  const organization = useOrganization();
  const href = normalizeUrl(
    generateProfileFlamechartRoute({organization, projectSlug, profileId})
  );

  return (
    <ResourceLink
      icon={IconProfiling}
      href={href}
      title={t('Profile %s', getShortEventId(profileId))}
    />
  );
}

export const Profile = defineSeerEmbed({
  name: 'profile',
  render(props) {
    return <ProfileLink {...props} />;
  },
});
