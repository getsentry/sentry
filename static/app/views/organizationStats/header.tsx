import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type Props = {
  organization: Organization;
  activeTab: 'stats' | 'issues' | 'health';
};

function StatsHeader({organization, activeTab}: Props) {
  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <StyledLayoutTitle>{t('Stats')}</StyledLayoutTitle>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        {activeTab !== 'stats' && (
          <Button
            title={t('Send us feedback via email')}
            size="small"
            href="mailto:workflow-feedback@sentry.io?subject=Team Stats Feedback"
          >
            {t('Give Feedback')}
          </Button>
        )}
      </Layout.HeaderActions>
      <Layout.HeaderNavTabs underlined>
        <li className={`${activeTab === 'stats' ? 'active' : ''}`}>
          <Link to={`/organizations/${organization.slug}/stats/`}>{t('Usage')}</Link>
        </li>
        <li className={`${activeTab === 'issues' ? 'active' : ''}`}>
          <Link to={`/organizations/${organization.slug}/stats/issues/`}>
            {t('Issues')}
            <FeatureBadge type="beta" />
          </Link>
        </li>
        <li className={`${activeTab === 'health' ? 'active' : ''}`}>
          <Link to={`/organizations/${organization.slug}/stats/health/`}>
            {t('Health')}
            <FeatureBadge type="beta" />
          </Link>
        </li>
      </Layout.HeaderNavTabs>
    </Layout.Header>
  );
}

export default StatsHeader;

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;
