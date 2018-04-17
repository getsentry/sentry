import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Box} from '../../../components/grid';
import {t} from '../../../locale';
import AlertLink from '../../../components/alertLink';
import AsyncView from '../../asyncView';
import Form from '../components/forms/form';
import InlineSvg from '../../../components/inlineSvg';
import JsonForm from '../components/forms/jsonForm';
import Link from '../../../components/link';
import {PanelFooter} from '../../../components/panels';
import SettingsPageHeader from '../components/settingsPageHeader';
import accountNotificationFields from '../../../data/forms/accountNotificationSettings';

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
            <AlertLink to="/settings/account/emails" icon="icon-mail">
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
    let {path, text} = this.props;
    let baseUrl = '/settings/account/notifications/';

    return (
      <PanelFooter css={{borderTop: 'none'}}>
        <FineTuneLink to={`${baseUrl}${path}`}>
          <span>{text}</span>
          <InlineSvg src="icon-chevron-right" size="15px" />
        </FineTuneLink>
      </PanelFooter>
    );
  }
}
