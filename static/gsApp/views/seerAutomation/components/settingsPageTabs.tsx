import {Container} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

export function SettingsPageTabs() {
  const organization = useOrganization();
  const {pathname} = useLocation();

  const prefix = `/settings/${organization.slug}`;
  const tabs = (
    showNewSeer(organization)
      ? [
          [t('Overview'), '/seer/'],
          [t('Repositories'), '/seer/scm/'],
          [t('Autofix'), '/seer/projects/'],
          [t('Code Review'), '/seer/repos/'],
        ]
      : [
          [t('Autofix'), '/seer/'],
          [t('Code Review'), '/seer/repos/'],
          [t('Repositories'), '/seer/scm/'],
        ]
  ) satisfies Array<[string, string]>;

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
