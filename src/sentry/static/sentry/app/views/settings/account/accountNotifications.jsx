import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';

import AsyncView from '../../asyncView';
import Link from '../../../components/link';

import SettingsPageHeader from '../components/settingsPageHeader';
import accountNotificationFields from '../../../data/forms/accountNotificationSettings';

import ApiForm from '../components/forms/apiForm';
import FieldFromConfig from '../components/forms/fieldFromConfig';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import PanelFooter from '../components/panelFooter';

import InlineSvg from '../../../components/inlineSvg';

export default class AccountNotifications extends AsyncView {
  getEndpoints() {
    return [['data', '/users/me/notifications/']];
  }

  renderBody() {
    return (
      <div>
        <SettingsPageHeader label="Notifications" />
        <ApiForm
          initialData={this.state.data}
          apiMethod="PUT"
          apiEndpoint={'/users/me/notifications/'}
        >
          <Box>
            {accountNotificationFields.map(field => {
              return <FormField key={field.title} field={field} />;
            })}
          </Box>
        </ApiForm>
      </div>
    );
  }
}

class FormField extends React.Component {
  static propTypes = {
    field: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
  }
  render() {
    let {title, fields, fineTuning} = this.props.field;

    let linkStyle = {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '15px 20px',
      color: 'inherit',
    };

    let baseUrl = '/settings/account/notifications/';

    return (
      <Panel key={title} id={title}>
        <PanelHeader>{title}</PanelHeader>
        <PanelBody>
          {fields.map(field => <FieldFromConfig key={field.name} field={field} />)}
        </PanelBody>
        {fineTuning && (
          <PanelFooter>
            <Link to={`${baseUrl}${fineTuning.path}`} style={linkStyle}>
              <span>{fineTuning.text}</span>
              <InlineSvg src="icon-chevron-right" size="15px" />
            </Link>
          </PanelFooter>
        )}
      </Panel>
    );
  }
}
