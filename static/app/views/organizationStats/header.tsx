import styled from '@emotion/styled';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import PageHeading from 'sentry/components/pageHeading';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';

type Props = {
  activeTab: 'stats' | 'issues' | 'health';
  organization: Organization;
};

function StatsHeader({organization, activeTab}: Props) {
  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <StyledHeading>
          {t('Stats')}
          <PageHeadingQuestionTooltip
            title={tct(
              'A view of the usage data that Sentry has received across your entire organization. [link: Read the docs].',
              {link: <ExternalLink href="https://docs.sentry.io/product/stats/" />}
            )}
          />
        </StyledHeading>
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

const StyledHeading = styled(PageHeading)`
  line-height: 40px;
`;
