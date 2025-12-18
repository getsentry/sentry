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
    [t('Settings'), normalizeUrl(`/settings/${organization.slug}/seer/`)],
    [t('Projects'), normalizeUrl(`/settings/${organization.slug}/seer/projects/`)],
    [t('Repos'), normalizeUrl(`/settings/${organization.slug}/seer/repos/`)],
  ];

  return (
    <Container borderBottom="primary">
      <Tabs onChange={key => navigate(key)} value={pathname}>
        <TabList>
          {tabs.map(([label, to]) => (
            <TabList.Item key={to} to={to}>
              {label}
            </TabList.Item>
          ))}
        </TabList>
      </Tabs>
    </Container>
  );
}
