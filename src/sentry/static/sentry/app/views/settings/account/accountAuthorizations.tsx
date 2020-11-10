import {Link} from 'react-router';
import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {ApiApplication} from 'app/types';
import space from 'app/styles/space';

type Authorization = {
  application: ApiApplication;
  homepageUrl: string;
  id: string;
  scopes: string[];
};

type Props = RouteComponentProps<{}, {}>;

type State = {
  data: Authorization[];
} & AsyncView['state'];

class AccountAuthorizations extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['data', '/api-authorizations/']];
  }

  getTitle() {
    return 'Approved Applications';
  }

  handleRevoke = authorization => {
    const oldData = this.state.data;

    this.setState(
      state => ({
        data: state.data.filter(({id}) => id !== authorization.id),
      }),
      async () => {
        try {
          await this.api.requestPromise('/api-authorizations/', {
            method: 'DELETE',
            data: {authorization: authorization.id},
          });

          addSuccessMessage(t('Saved changes'));
        } catch (_err) {
          this.setState({
            data: oldData,
          });
          addErrorMessage(t('Unable to save changes, please try again'));
        }
      }
    );
  };

  renderBody() {
    const {data} = this.state;
    const isEmpty = data.length === 0;
    return (
      <div>
        <SettingsPageHeader title="Authorized Applications" />
        <Description>
          {tct('You can manage your own applications via the [link:API dashboard].', {
            link: <Link to="/settings/account/api/" />,
          })}
        </Description>

        <Panel>
          <PanelHeader>{t('Approved Applications')}</PanelHeader>

          <PanelBody>
            {isEmpty && (
              <EmptyMessage>
                {t("You haven't approved any third party applications.")}
              </EmptyMessage>
            )}

            {!isEmpty && (
              <div>
                {data.map(authorization => (
                  <PanelItemCenter key={authorization.id}>
                    <ApplicationDetails>
                      <ApplicationName>{authorization.application.name}</ApplicationName>
                      {authorization.homepageUrl && (
                        <Url>
                          <a href={authorization.homepageUrl}>
                            {authorization.homepageUrl}
                          </a>
                        </Url>
                      )}
                      <Scopes>{authorization.scopes.join(', ')}</Scopes>
                    </ApplicationDetails>
                    <Button
                      size="small"
                      onClick={() => this.handleRevoke(authorization)}
                      icon={<IconDelete />}
                    />
                  </PanelItemCenter>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default AccountAuthorizations;

const Description = styled('p')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  margin-bottom: ${space(4)};
`;

const PanelItemCenter = styled(PanelItem)`
  align-items: center;
`;

const ApplicationDetails = styled('div')`
  display: flex;
  flex: 1;
  flex-direction: column;
`;

const ApplicationName = styled('div')`
  font-weight: bold;
  margin-bottom: ${space(0.5)};
`;

/**
 * Intentionally wrap <a> so that it does not take up full width and cause
 * hit box issues
 */
const Url = styled('div')`
  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const Scopes = styled('div')`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;
