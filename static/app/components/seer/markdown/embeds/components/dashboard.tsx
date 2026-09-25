import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {
  ResourceLink,
  type ResourceLinkFormatProps,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconDashboard} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

const LazyDashboardBlock = lazy(() => import('./dashboardBlock'));

function DashboardLink({
  format,
  id,
  title,
}: EmbedOutput<'dashboard'> & ResourceLinkFormatProps) {
  const organization = useOrganization();

  if (!id) {
    return null;
  }

  const href = normalizeUrl(`/organizations/${organization.slug}/dashboard/${id}/`);

  return (
    <ResourceLink
      format={format}
      icon={IconDashboard}
      href={href}
      title={title ?? t('Dashboard %s', id)}
    />
  );
}

export const Dashboard = defineSeerEmbed({
  name: 'dashboard',
  render(props, level) {
    switch (level) {
      case 'block':
        return <LazyLoad LazyComponent={LazyDashboardBlock} {...props} />;
      case 'markdown':
        return <DashboardLink {...props} format="markdown" />;
      case 'inline':
        return <DashboardLink {...props} />;
    }
  },
});
