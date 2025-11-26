import {Container} from '@sentry/scraps/layout/container';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export default function SettingsPageTabs() {
  const navigate = useNavigate();
  const {pathname} = useLocation();

  return (
    <Container borderBottom="primary">
      <Tabs onChange={key => navigate(key)} value={pathname}>
        <TabList>
          <TabList.Item key="/settings/seer/">{t('Settings')}</TabList.Item>
          <TabList.Item key="/settings/seer/projects/">{t('Projects')}</TabList.Item>
          <TabList.Item key="/settings/seer/repos/">{t('Repos')}</TabList.Item>
        </TabList>
      </Tabs>
    </Container>
  );
}
