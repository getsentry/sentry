import type {Path} from 'history';

import {Container} from '@sentry/scraps/layout/container';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

export default function SettingsPageTabs() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {pathname} = useLocation();

  const tabs: Array<[string, Path]> = [
    [t('Settings'), `/settings/${organization.slug}/seer/`],
    [t('Projects'), `/settings/${organization.slug}/seer/projects/`],
    [t('Repos'), `/settings/${organization.slug}/seer/repos/`],
  ];
  const normalizedTabs = tabs.map<[string, string]>(([label, to]) => [
    label,
    normalizeUrl(to),
  ]);
  const activeTab =
    normalizedTabs.find(([, to]) => pathname.startsWith(to))?.[1] ?? pathname;

  return (
    <Container borderBottom="primary">
      <Tabs onChange={key => navigate(key)} value={activeTab}>
        <TabList>
          {normalizedTabs.map(([label, to]) => (
            <TabList.Item key={to} to={to}>
              {label}
            </TabList.Item>
          ))}
        </TabList>
      </Tabs>
    </Container>
  );
}
