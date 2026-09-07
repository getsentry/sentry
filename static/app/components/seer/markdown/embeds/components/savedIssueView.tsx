import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

function SavedIssueViewLink({id, name}: EmbedOutput<'savedIssueView'>) {
  const organization = useOrganization();
  const href = normalizeUrl(`/organizations/${organization.slug}/issues/views/${id}/`);

  return (
    <ResourceLink icon={IconStar} href={href} title={name ?? t('Issue view %s', id)} />
  );
}

export const SavedIssueView = defineSeerEmbed({
  name: 'savedIssueView',
  render(props) {
    return <SavedIssueViewLink {...props} />;
  },
});
