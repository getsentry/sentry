import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from '../../../locale';
import AsyncView from '../../asyncView';
import Button from '../../../components/buttons/button';
import EmptyMessage from '../components/emptyMessage';
import IndicatorStore from '../../../stores/indicatorStore';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import Row from '../components/row';
import SettingsPageHeader from '../components/settingsPageHeader';

class AuthorizationRow extends React.Component {
  static propTypes = {
    authorization: PropTypes.object.isRequired,
    onRevoke: PropTypes.func.isRequired,
  };

  handleRevoke = () => {
    let {authorization} = this.props;
    this.props.onRevoke(authorization);
  };

  render() {
    let authorization = this.props.authorization;

    return (
      <Row>
        <Flex flex="1">
          <Flex p={2} flex="1" direction="column">
            <h5 style={{marginBottom: 5}}>{authorization.application.name}</h5>
            {authorization.homepageUrl && (
              <div style={{marginBottom: 5}}>
                <small>
                  <a href={authorization.homepageUrl}>{authorization.homepageUrl}</a>
                </small>
              </div>
            )}
            <div>
              <small style={{color: '#999'}}>{authorization.scopes.join(', ')}</small>
            </div>
          </Flex>
          <Flex p={2} align="center">
            <Button onClick={this.handleRevoke}>
              <span className="icon icon-trash" />
            </Button>
          </Flex>
        </Flex>
      </Row>
    );
  }
}

const Description = styled.p`
  font-size: 0.9em;
  margin-bottom: 30px;
`;

class AccountAuthorizations extends AsyncView {
  getEndpoints() {
    return [['data', '/api-authorizations/']];
  }

  getTitle() {
    return 'Approved Applications - Sentry';
  }

  handleRevoke = authorization => {
    let oldData = this.state.data;

    this.setState(
      state => ({
        data: state.data.filter(({id}) => id !== authorization.id),
      }),
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        this.api.request('/api-authorizations/', {
          method: 'DELETE',
          data: {authorization: authorization.id},
          success: data => {
            IndicatorStore.remove(loadingIndicator);
          },
          error: () => {
            this.setState({
              data: oldData,
            });
            IndicatorStore.remove(loadingIndicator);
            IndicatorStore.addError(t('Unable to save changes. Please try again.'));
          },
        });
      }
    );
  };

  renderBody() {
    let {data} = this.state;
    let isEmpty = data.length === 0;

    return (
      <div>
        <SettingsPageHeader label="Authorized Applications" />
        <Description>
          {tct('You can manage your own applications via the [link:API dashboard].', {
            link: <a href="/settings/account/api/" />,
          })}
        </Description>

        <Panel>
          <PanelHeader disablePadding={true}>
            <Flex align="center">
              <Box px={2} flex="1">
                {t('Approved Applications')}
              </Box>
            </Flex>
          </PanelHeader>

          <PanelBody>
            {isEmpty && (
              <EmptyMessage>
                {t("You haven't approved any third party applications.")}
              </EmptyMessage>
            )}

            {!isEmpty && (
              <div>
                {data.map(authorization => {
                  return (
                    <AuthorizationRow
                      key={authorization.id}
                      authorization={authorization}
                      onRevoke={this.handleRevoke}
                    />
                  );
                })}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default AccountAuthorizations;
