/**
 * Lists 2fa devices + password change form
 */
import React from 'react';
import styled from 'react-emotion';

import {Box, Flex} from '../../../../components/grid';
import {addErrorMessage} from '../../../../actionCreators/indicator';
import {t} from '../../../../locale';
import AsyncView from '../../../asyncView';
import Button from '../../../../components/buttons/button';
import CircleIndicator from '../../../../components/circleIndicator';
import EmptyMessage from '../../components/emptyMessage';
import {Panel, PanelBody, PanelHeader, PanelItem} from '../../../../components/panels';
import SettingsPageHeader from '../../components/settingsPageHeader';
import TextBlock from '../../components/text/textBlock';
import RemoveConfirm from './components/removeConfirm';
import PasswordForm from '../passwordForm';

const ENDPOINT = '/users/me/authenticators/';

const AuthenticatorName = styled.span`
  font-size: 1.2em;
`;

class AccountSecurity extends AsyncView {
  getEndpoints() {
    return [['authenticators', '/users/me/authenticators/']];
  }

  getTitle() {
    return t('Security');
  }

  handleDisable = auth => {
    if (!auth || !auth.authId) return;

    this.setState(
      {
        loading: true,
      },
      () =>
        this.api
          .requestPromise(`${ENDPOINT}${auth.authId}/`, {
            method: 'DELETE',
          })
          .then(this.remountComponent, () => {
            this.setState({loading: false});
            addErrorMessage(t('Error disabling', auth.name));
          })
    );
  };

  renderBody() {
    let isEmpty = !this.state.authenticators.length;

    return (
      <div>
        <SettingsPageHeader title="Security" />

        <PasswordForm />

        <Panel>
          <PanelHeader>
            <Box>{t('Two Factor Authentication')}</Box>
          </PanelHeader>

          {isEmpty && (
            <EmptyMessage>{t('No available authenticators to add')}</EmptyMessage>
          )}

          <PanelBody>
            {!isEmpty &&
              this.state.authenticators.map(auth => {
                let {
                  id,
                  authId,
                  description,
                  isBackupInterface,
                  isEnrolled,
                  configureButton,
                  name,
                } = auth;
                return (
                  <PanelItem key={id} p={0} direction="column">
                    <Flex flex="1" p={2} align="center">
                      <Box flex="1">
                        <CircleIndicator css={{marginRight: 6}} enabled={isEnrolled} />
                        <AuthenticatorName>{name}</AuthenticatorName>
                      </Box>

                      {!isBackupInterface &&
                        !isEnrolled && (
                          <Button
                            to={`/settings/account/security/${id}/enroll/`}
                            size="small"
                            priority="primary"
                          >
                            {t('Add')}
                          </Button>
                        )}

                      {isEnrolled &&
                        authId && (
                          <Button
                            to={`/settings/account/security/${authId}/`}
                            size="small"
                          >
                            {configureButton}
                          </Button>
                        )}

                      {!isBackupInterface &&
                        isEnrolled && (
                          <RemoveConfirm onConfirm={() => this.handleDisable(auth)}>
                            <Button css={{marginLeft: 6}} size="small">
                              <span className="icon icon-trash" />
                            </Button>
                          </RemoveConfirm>
                        )}

                      {isBackupInterface && !isEnrolled ? t('requires 2FA') : null}
                    </Flex>

                    <Box p={2} pt={0}>
                      <TextBlock css={{marginBottom: 0}}>{description}</TextBlock>
                    </Box>
                  </PanelItem>
                );
              })}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default AccountSecurity;
