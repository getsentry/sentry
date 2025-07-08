import styled from '@emotion/styled';

import {TabList} from 'sentry/components/core/tabs';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';
import {makeStatsPathname} from 'sentry/views/organizationStats/pathname';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Props = {
  activeTab: 'stats' | 'issues' | 'health';
  organization: Organization;
};

function StatsHeaderTabs({organization}: Props) {
  return (
    <TabList hideBorder>
      <TabList.Item
        key="stats"
        to={makeStatsPathname({
          path: '/',
          organization,
        })}
      >
        {t('Usage')}
      </TabList.Item>
      <TabList.Item
        key="issues"
        to={makeStatsPathname({
          path: '/issues/',
          organization,
        })}
      >
        {t('Issues')}
      </TabList.Item>
      <TabList.Item
        key="health"
        to={makeStatsPathname({
          path: '/health/',
          organization,
        })}
      >
        {t('Health')}
      </TabList.Item>
    </TabList>
  );
}

function StatsHeader({organization, activeTab}: Props) {
  const prefersStackedNav = usePrefersStackedNav();

  if (prefersStackedNav) {
    return (
      <SettingsPageHeader
        title={t('Stats & Usage')}
        subtitle={t(
          'A view of the usage data that Sentry has received across your entire organization.'
        )}
        tabs={
          <TabsContainer value={activeTab}>
            <StatsHeaderTabs organization={organization} activeTab={activeTab} />
          </TabsContainer>
        }
      />
    );
  }

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
        <StatsHeaderTabs organization={organization} activeTab={activeTab} />
      </Layout.HeaderTabs>
    </Layout.Header>
  );
}

const TabsContainer = styled(Layout.HeaderTabs)`
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: ${space(2)};
`;

export default StatsHeader;
