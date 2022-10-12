import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {BreadcrumbProvider} from 'sentry/views/settings/components/settingsBreadcrumb/context';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';
import SettingsNavigation from 'sentry/views/settings/components/settingsNavigation';

const renderAdminNavigation = () => (
  <SettingsNavigation
    stickyTop="0"
    navigationObjects={[
      {
        name: 'System Status',
        items: [
          {path: '/manage/', index: true, title: 'Overview'},
          {path: '/manage/buffer/', title: 'Buffer'},
          {path: '/manage/queue/', title: 'Queue'},
          {path: '/manage/quotas/', title: 'Quotas'},
          {path: '/manage/status/environment/', title: 'Environment'},
          {path: '/manage/status/packages/', title: 'Packages'},
          {path: '/manage/status/mail/', title: 'Mail'},
          {path: '/manage/status/warnings/', title: 'Warnings'},
          {path: '/manage/settings/', title: 'Settings'},
        ],
      },
      {
        name: 'Manage',
        items: [
          {path: '/manage/organizations/', title: 'Organizations'},
          {path: '/manage/projects/', title: 'Projects'},
          {path: '/manage/users/', title: 'Users'},
        ],
      },
    ]}
  />
);

type Props = {
  children: React.ReactNode;
} & RouteComponentProps<{}, {}>;

function AdminLayout({children, ...props}: Props) {
  return (
    <SentryDocumentTitle noSuffix title={t('Sentry Admin')}>
      <Page>
        <BreadcrumbProvider>
          <SettingsLayout renderNavigation={renderAdminNavigation} {...props}>
            {children}
          </SettingsLayout>
        </BreadcrumbProvider>
      </Page>
    </SentryDocumentTitle>
  );
}

export default AdminLayout;

const Page = styled('div')`
  display: flex;
  flex-grow: 1;
`;
