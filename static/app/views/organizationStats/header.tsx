import styled from '@emotion/styled';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type Props = {
  activeTab: 'stats' | 'issues' | 'health';
  organization: Organization;
};

function StatsHeader({organization, activeTab}: Props) {
  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <StyledLayoutTitle>{t('Stats')}</StyledLayoutTitle>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        {activeTab !== 'stats' && (
          <FeatureFeedback buttonProps={{size: 'sm'}} featureName="team-stats" />
        )}
      </Layout.HeaderActions>
      <Layout.HeaderNavTabs underlined>
        <li className={`${activeTab === 'stats' ? 'active' : ''}`}>
          <Link to={`/organizations/${organization.slug}/stats/`}>{t('Usage')}</Link>
        </li>
        <li className={`${activeTab === 'issues' ? 'active' : ''}`}>
          <Link to={`/organizations/${organization.slug}/stats/issues/`}>
            {t('Issues')}
          </Link>
        </li>
        <li className={`${activeTab === 'health' ? 'active' : ''}`}>
          <Link to={`/organizations/${organization.slug}/stats/health/`}>
            {t('Health')}
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
