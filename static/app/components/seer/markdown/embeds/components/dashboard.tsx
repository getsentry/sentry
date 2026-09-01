import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconDashboard} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

function DashboardLink({id, title}: EmbedOutput<'dashboard'>) {
  const organization = useOrganization();
  const href = normalizeUrl(`/organizations/${organization.slug}/dashboard/${id}/`);

  return (
    <ResourceLink
      icon={IconDashboard}
      href={href}
      title={title ?? t('Dashboard %s', id)}
    />
  );
}

export const Dashboard = defineSeerEmbed({
  name: 'dashboard',
  render(props) {
    return <DashboardLink {...props} />;
  },
});
