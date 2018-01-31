import {Box, Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {
  addErrorMessage,
  addSuccessMessage,
} from '../../../../actionCreators/settingsIndicator';
import {t} from '../../../../locale';
import AsyncView from '../../../asyncView';
import Button from '../../../../components/buttons/button';
import CircleIndicator from '../../../../components/circleIndicator';
import Confirm from '../../../../components/confirm';
import DateTime from '../../../../components/dateTime';
import Panel from '../../components/panel';
import PanelBody from '../../components/panelBody';
import PanelHeader from '../../components/panelHeader';
import PanelItem from '../../components/panelItem';
import RecoveryCodes from './components/recoveryCodes';
import SettingsPageHeader from '../../components/settingsPageHeader';
import TextBlock from '../../components/text/textBlock';

const ENDPOINT = '/users/me/authenticators/';

const DateLabel = styled.span`
  font-weight: bold;
  margin-right: 6px;
  width: 100px;
`;

const Phone = styled.span`
  font-weight: bold;
  margin-left: 6px;
`;

const Header = styled.div`
  font-size: 1.2em;
  margin-bottom: 10px;
`;

class AuthenticatorDate extends React.Component {
  static propTypes = {
    label: PropTypes.string,
    /**
     * Can be null or a Date object.
     * Component will return null if date is undefined, but will
     * have value "never" if it is null
     */
    date: PropTypes.string,
  };
  render() {
    let {label, date} = this.props;
    // `date` can be null
    if (typeof date === 'undefined') return null;

    return (
      <Flex mb={1}>
        <DateLabel>{label}</DateLabel>
        <Box flex="1">{date ? <DateTime date={date} /> : 'never'}</Box>
      </Flex>
    );
  }
}

class AccountSecurityDetails extends AsyncView {
  constructor(...args) {
    super(...args);
    this._form = {};
  }

  getEndpoints() {
    return [['authenticator', `${ENDPOINT}${this.props.params.authId}/`]];
  }

  handleRemove = () => {
    let {authenticator} = this.state;

    if (!authenticator || !authenticator.authId) return;

    this.setState(
      {
        loading: true,
      },
      () =>
        this.api
          .requestPromise(`${ENDPOINT}${authenticator.authId}/`, {
            method: 'DELETE',
          })
          .then(
            () => {
              this.props.router.push('/settings/account/security');
              addSuccessMessage(t('Authenticator has been removed'));
            },
            () => {
              // Error deleting authenticator
              addErrorMessage(t('Error removing authenticator'));
            }
          )
    );
  };

  handleRegenerateBackupCodes = () => {
    this.setState({loading: true}, () =>
      this.api
        .requestPromise(`${ENDPOINT}${this.props.params.authId}/`, {
          method: 'PUT',
        })
        .then(this.remountComponent, () => {})
    );
  };

  renderBody() {
    let {authenticator} = this.state;

    return (
      <div>
        <SettingsPageHeader
          title={
            <React.Fragment>
              <span>{authenticator.name}</span>
              <CircleIndicator css={{marginLeft: 6}} enabled={authenticator.isEnrolled} />
            </React.Fragment>
          }
          action={
            authenticator.isEnrolled &&
            authenticator.removeButton && (
              <Confirm
                onConfirm={this.handleRemove}
                message={
                  <React.Fragment>
                    <Header>{t('Do you want to remove the method?')}</Header>
                    <TextBlock>
                      {t(
                        'You will no longer be able to use it for two-factor authentication afterwards. Removing the last authenticator removes two-factor authentication completely.'
                      )}
                    </TextBlock>
                  </React.Fragment>
                }
              >
                <Button priority="danger">{authenticator.removeButton}</Button>
              </Confirm>
            )
          }
        />

        <TextBlock>{authenticator.description}</TextBlock>

        <AuthenticatorDate label={t('Created at')} date={authenticator.createdAt} />

        <AuthenticatorDate label={t('Last used')} date={authenticator.lastUsedAt} />

        {authenticator.isEnrolled &&
          authenticator.devices && (
            <Panel css={{marginTop: 30}}>
              <PanelHeader>{t('Device name')}</PanelHeader>

              <PanelBody>
                {authenticator.devices.map(device => (
                  <PanelItem key={device.name}>
                    <Flex p={2} pr={0} align="center" flex="1">
                      <Box flex="1">{device.name}</Box>
                      <div css={{fontSize: '0.8em', opacity: 0.6}}>
                        <DateTime date={device.timestamp} />
                      </div>
                    </Flex>

                    <Box p={2}>
                      <Button size="small" priority="danger">
                        <span className="icon icon-trash" />
                      </Button>
                    </Box>
                  </PanelItem>
                ))}
                <PanelItem justify="flex-end" p={2}>
                  <Button type="button" to="/settings/account/security/u2f/enroll/">
                    {t('Add Another Device')}
                  </Button>
                </PanelItem>
              </PanelBody>
            </Panel>
          )}
        {authenticator.isEnrolled &&
          authenticator.phone && (
            <div css={{marginTop: 30}}>
              {t('Confirmation codes are sent to the following phone number')}:
              <Phone>{authenticator.phone}</Phone>
            </div>
          )}

        <RecoveryCodes
          onRegenerateBackupCodes={this.handleRegenerateBackupCodes}
          isEnrolled={authenticator.isEnrolled}
          codes={authenticator.codes}
        />
      </div>
    );
  }
}

export default withRouter(AccountSecurityDetails);
