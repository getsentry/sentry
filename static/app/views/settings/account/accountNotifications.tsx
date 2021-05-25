import styled from '@emotion/styled';

import AlertLink from 'app/components/alertLink';
import Link from 'app/components/links/link';
import {PanelFooter} from 'app/components/panels';
import accountNotificationFields from 'app/data/forms/accountNotificationSettings';
import {IconChevron, IconMail} from 'app/icons';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import withOrganizations from 'app/utils/withOrganizations';
import AsyncView from 'app/views/asyncView';
import NotificationSettings from 'app/views/settings/account/notifications/notificationSettings';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

const FINE_TUNE_FOOTERS = {
  [t('Alerts')]: {
    text: t('Fine tune alerts by project'),
    path: 'alerts/',
  },
  [t('Workflow Notifications')]: {
    text: t('Fine tune workflow notifications by project'),
    path: 'workflow/',
  },
  [t('Email Routing')]: {
    text: t('Fine tune email routing by project'),
    path: 'email/',
  },
  [t('Weekly Reports')]: {
    text: t('Fine tune weekly reports by organization'),
    path: 'reports/',
  },
  [t('Deploy Notifications')]: {
    text: t('Fine tune deploy notifications by organization'),
    path: 'deploy/',
  },
};

type Props = AsyncView['props'] & {
  organizations: OrganizationSummary[];
};

type State = AsyncView['state'] & {
  data: Record<string, unknown> | null;
};

class AccountNotifications extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['data', '/users/me/notifications/']];
  }

  getTitle() {
    return 'Notifications';
  }

  renderBody() {
    const {organizations} = this.props;
    if (
      organizations.some(organization =>
        organization.features.includes('notification-platform')
      )
    ) {
      return <NotificationSettings />;
    }

    return (
      <div>
        <SettingsPageHeader title="Notifications" />
        <Form
          initialData={this.state.data ?? undefined}
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notifications/"
        >
          <JsonForm
            forms={accountNotificationFields}
            renderFooter={({title}) => {
              if (typeof title !== 'string') {
                return null;
              }
              if (FINE_TUNE_FOOTERS[title]) {
                return <FineTuningFooter {...FINE_TUNE_FOOTERS[title]} />;
              }
              return null;
            }}
          />
          <AlertLink to="/settings/account/emails" icon={<IconMail />}>
            {t('Looking to add or remove an email address? Use the emails panel.')}
          </AlertLink>
        </Form>
      </div>
    );
  }
}

const FineTuneLink = styled(Link)`
  display: flex;
  justify-content: space-between;
  padding: 15px 20px;
  color: inherit;
`;

type FooterProps = {
  path: string;
  text: string;
};

const FineTuningFooter = ({path, text}: FooterProps) => (
  <PanelFooter css={{borderTop: 'none'}}>
    <FineTuneLink to={`/settings/account/notifications/${path}`}>
      <span>{text}</span>
      <IconChevron direction="right" size="15px" />
    </FineTuneLink>
  </PanelFooter>
);

export default withOrganizations(AccountNotifications);
