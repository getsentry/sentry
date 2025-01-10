import {FeatureFeedback} from 'sentry/components/featureFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {TabList} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

type Props = {
  activeTab: 'stats' | 'issues' | 'health';
  organization: Organization;
};

function StatsHeader({organization, activeTab}: Props) {
  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Layout.Title>
          {t('Stats')}
          <PageHeadingQuestionTooltip
            docsUrl="https://docs.sentry.io/product/stats/"
            title={t(
              'A view of the usage data that Sentry has received across your entire organization.'
            )}
          />
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        {activeTab !== 'stats' && (
          <FeatureFeedback buttonProps={{size: 'sm'}} featureName="team-stats" />
        )}
      </Layout.HeaderActions>
      <Layout.HeaderTabs value={activeTab}>
        <TabList hideBorder>
          <TabList.Item
            key="stats"
            to={normalizeUrl(`/organizations/${organization.slug}/stats/`)}
          >
            {t('Usage')}
          </TabList.Item>
          <TabList.Item
            key="issues"
            to={normalizeUrl(`/organizations/${organization.slug}/stats/issues/`)}
          >
            {t('Issues')}
          </TabList.Item>
          <TabList.Item
            key="health"
            to={normalizeUrl(`/organizations/${organization.slug}/stats/health/`)}
          >
            {t('Health')}
          </TabList.Item>
        </TabList>
      </Layout.HeaderTabs>
    </Layout.Header>
  );
}

export default StatsHeader;
