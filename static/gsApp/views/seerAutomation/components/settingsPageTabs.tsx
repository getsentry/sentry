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

  const tabs = showNewSeer(organization)
    ? [
        [t('Overview'), `/settings/${organization.slug}/seer/`],
        [t('Source Code Management'), `/settings/${organization.slug}/seer/scm/`],
        [t('Autofix'), `/settings/${organization.slug}/seer/projects/`],
        [t('Code Review'), `/settings/${organization.slug}/seer/repos/`],
      ]
    : [
        [t('Autofix'), `/settings/${organization.slug}/seer/`],
        [t('Code Review'), `/settings/${organization.slug}/seer/repos/`],
        [t('Source Code Management'), `/settings/${organization.slug}/seer/scm/`],
      ];

  return (
    <Container borderBottom="primary">
      <Tabs value={pathname}>
        <TabList>
          {tabs.map(([label, to]) => (
            <TabList.Item key={normalizeUrl(to)} to={normalizeUrl(to)}>
              {label}
            </TabList.Item>
          ))}
        </TabList>
      </Tabs>
    </Container>
  );
}
