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
          [t('Source Code Management'), '/seer/scm/'],
          [t('Autofix'), '/seer/projects/'],
          [t('Code Review'), '/seer/repos/'],
        ]
      : [
          [t('Autofix'), '/seer/'],
          [t('Code Review'), '/seer/repos/'],
          [t('Source Code Management'), '/seer/scm/'],
        ]
  ) satisfies Array<[string, string]>;

  return (
    <Container borderBottom="primary">
      <Tabs value={pathname}>
        <TabList>
          {tabs.map(([label, to]) => {
            const tabPath = prefix + to;
            const normalized = normalizeUrl(tabPath);
            // We need to normalize the `key` prop because that value is used to
            // identify which tab to highlight, the value needs to match the
            // value of the `value` prop on the `Tabs` component.
            // The Tab component will render `TabLink` which extends `Link`and
            // normalizes the url for us.
            //
            // If we manually make the call then it'll be double-normalized,
            // we'd have `/settings/repos/` instead of `/settings/seer/repos/`.
            return (
              <TabList.Item key={normalized} to={{pathname: tabPath}}>
                {label}
              </TabList.Item>
            );
          })}
        </TabList>
      </Tabs>
    </Container>
  );
}
