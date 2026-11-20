import {Fragment} from 'react';

import {Container} from '@sentry/scraps/layout';
import {LinkTabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {makeStatsPathname} from './pathname';

type Props = {
  activeTab: 'stats' | 'seer' | 'issues' | 'health';
  organization: Organization;
};

export function StatsHeader({organization, activeTab}: Props) {
  const showSeerTab = organization.features.includes('token-billed-seer-enabled');
  const showTeamInsightsTabs = organization.features.includes('team-insights');

  return (
    <Fragment>
      <SettingsPageHeader
        title={t('Stats & Usage')}
        subtitle={t(
          'A view of the usage data that Sentry has received across your entire organization.'
        )}
      />
      {(showSeerTab || showTeamInsightsTabs) && (
        <Container borderBottom="primary" marginBottom="xl">
          <LinkTabs value={activeTab}>
            {({TabList}) => (
              <TabList>
                <TabList.Item
                  key="stats"
                  to={makeStatsPathname({path: '/', organization})}
                >
                  {t('Usage')}
                </TabList.Item>
                <TabList.Item
                  key="issues"
                  hidden={!showTeamInsightsTabs}
                  to={makeStatsPathname({path: '/issues/', organization})}
                >
                  {t('Issues')}
                </TabList.Item>
                <TabList.Item
                  key="health"
                  hidden={!showTeamInsightsTabs}
                  to={makeStatsPathname({path: '/health/', organization})}
                >
                  {t('Health')}
                </TabList.Item>
                <TabList.Item
                  key="seer"
                  hidden={!showSeerTab}
                  to={makeStatsPathname({path: '/seer/', organization})}
                >
                  {t('Seer')}
                </TabList.Item>
              </TabList>
            )}
          </LinkTabs>
        </Container>
      )}
    </Fragment>
  );
}
