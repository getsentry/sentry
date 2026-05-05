import {Container} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

import {orgHasCodeReviewFeature} from 'getsentry/views/seerAutomation/utils';

export function SettingsPageTabs() {
  const organization = useOrganization();
  const {pathname} = useLocation();

  const prefix = `/settings/${organization.slug}`;
  const hasCodeReviewAccess = orgHasCodeReviewFeature(organization);

  const tabsData = showNewSeer(organization)
    ? [
        [t('Repositories'), '/seer/scm/'],
        [t('Autofix'), '/seer/projects/'],
        [t('Code Review'), '/seer/repos/'],
        [t('Advanced Settings'), '/seer/advanced/'],
      ]
    : ([
        [t('Autofix'), '/seer/'],
        [t('Code Review'), '/seer/repos/'],
        [t('Repositories'), '/seer/scm/'],
      ] satisfies Array<[string, string]>);

  const tabs = hasCodeReviewAccess
    ? tabsData
    : tabsData.filter(([label]) => label !== t('Code Review'));

  return (
    <Container borderBottom="primary">
      <Tabs value={pathname}>
        <TabList>
          {tabs.map(([label, to]) => {
            const tabPath = prefix + to;
            const normalized = normalizeUrl(tabPath);
            return (
              <TabList.Item key={normalized} to={normalized}>
                {label}
              </TabList.Item>
            );
          })}
        </TabList>
      </Tabs>
    </Container>
  );
}
