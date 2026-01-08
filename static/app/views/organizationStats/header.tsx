import styled from '@emotion/styled';

import {TabList} from 'sentry/components/core/tabs';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {makeStatsPathname} from 'sentry/views/organizationStats/pathname';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Props = {
  activeTab: 'stats' | 'issues' | 'health';
  organization: Organization;
};

function StatsHeaderTabs({organization}: Props) {
  return (
    <TabList>
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

const TabsContainer = styled(Layout.HeaderTabs)`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  margin-bottom: ${space(2)};
`;

export default StatsHeader;
