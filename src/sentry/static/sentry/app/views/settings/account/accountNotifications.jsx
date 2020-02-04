import {Box} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import AlertLink from 'app/components/alertLink';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import {IconChevron, IconMail} from 'app/icons';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import Link from 'app/components/links/link';
import {PanelFooter} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import accountNotificationFields from 'app/data/forms/accountNotificationSettings';

const FINE_TUNE_FOOTERS = {
  Alerts: {
    text: 'Fine tune alerts by project',
    path: 'alerts/',
  },
  'Workflow Notifications': {
    text: 'Fine tune workflow notifications by project',
    path: 'workflow/',
  },
  'Email Routing': {
    text: 'Fine tune email routing by project',
    path: 'email/',
  },
  'Weekly Reports': {
    text: 'Fine tune weekly reports by organization',
    path: 'reports/',
  },
  'Deploy Notifications': {
    text: 'Fine tune deploy notifications by organization',
    path: 'deploy/',
  },
};

export default class AccountNotifications extends AsyncView {
  getEndpoints() {
    return [['data', '/users/me/notifications/']];
  }

  getTitle() {
    return 'Notifications';
  }

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title="Notifications" />
        <Form
          initialData={this.state.data}
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notifications/"
        >
          <Box>
            <JsonForm
              forms={accountNotificationFields}
              renderFooter={({title}) => {
                if (FINE_TUNE_FOOTERS[title]) {
                  return <FineTuningFooter {...FINE_TUNE_FOOTERS[title]} />;
                }
                return null;
              }}
            />
            <AlertLink to="/settings/account/emails" icon={<IconMail />}>
              {t('Looking to add or remove an email address? Use the emails panel.')}
            </AlertLink>
          </Box>
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

class FineTuningFooter extends React.Component {
  static propTypes = {
    path: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
  };

  render() {
    const {path, text} = this.props;
    const baseUrl = '/settings/account/notifications/';

    return (
      <PanelFooter css={{borderTop: 'none'}}>
        <FineTuneLink to={`${baseUrl}${path}`}>
          <span>{text}</span>
          <IconChevron direction="right" />
        </FineTuneLink>
      </PanelFooter>
    );
  }
}
