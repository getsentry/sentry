import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {makeStatsPathname} from 'sentry/views/organizationStats/pathname';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

type Props = {
  activeTab: 'stats' | 'issues' | 'health';
  organization: Organization;
};

export function StatsHeader({organization, activeTab}: Props) {
  return (
    <Fragment>
      <SettingsPageHeader
        title={t('Stats & Usage')}
        subtitle={t(
          'A view of the usage data that Sentry has received across your entire organization.'
        )}
      />
      <Stack borderBottom="primary" marginBottom="xl">
        <Tabs value={activeTab}>
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
        </Tabs>
      </Stack>
    </Fragment>
  );
}
