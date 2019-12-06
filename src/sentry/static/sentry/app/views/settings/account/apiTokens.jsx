import React from 'react';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import ApiTokenRow from 'app/views/settings/account/apiTokenRow';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

class ApiTokens extends AsyncView {
  getTitle() {
    return t('API Tokens');
  }

  getDefaultState() {
    return {
      loading: true,
      error: false,
      tokenList: [],
    };
  }

  getEndpoints() {
    return [['tokenList', '/api-tokens/']];
  }

  handleRemoveToken = token => {
    addLoadingMessage();
    const oldTokenList = this.state.tokenList;

    this.setState(
      state => ({
        tokenList: state.tokenList.filter(tk => tk.token !== token.token),
      }),
      async () => {
        try {
          await this.api.requestPromise('/api-tokens/', {
            method: 'DELETE',
            data: {token: token.token},
          });

          addSuccessMessage(t('Removed token'));
        } catch (_err) {
          addErrorMessage(t('Unable to remove token. Please try again.'));
          this.setState({
            tokenList: oldTokenList,
          });
        }
      }
    );
  };

  renderBody() {
    const {tokenList} = this.state;

    const isEmpty = tokenList.length === 0;

    const action = (
      <Button
        priority="primary"
        size="small"
        to="/settings/account/api/auth-tokens/new-token/"
        data-test-id="create-token"
      >
        {t('Create New Token')}
      </Button>
    );

    return (
      <div>
        <SettingsPageHeader title="Auth Tokens" action={action} />
        <TextBlock>
          {t(
            "Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
          )}
        </TextBlock>
        <TextBlock>
          {tct(
            'For more information on how to use the web API, see our [link:documentation].',
            {
              link: <a href="https://docs.sentry.io/hosted/api/" />,
            }
          )}
        </TextBlock>
        <TextBlock>
          <small>
            psst. Looking for the <strong>DSN</strong> for an SDK? You'll find that under{' '}
            <strong>[Project] » Settings » Client Keys</strong>.
          </small>
        </TextBlock>
        <Panel>
          <PanelHeader>{t('Auth Token')}</PanelHeader>

          <PanelBody>
            {isEmpty && (
              <EmptyMessage>
                {t("You haven't created any authentication tokens yet.")}
              </EmptyMessage>
            )}

            {!isEmpty &&
              tokenList.map(token => {
                return (
                  <ApiTokenRow
                    key={token.token}
                    token={token}
                    onRemove={this.handleRemoveToken}
                  />
                );
              })}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default ApiTokens;
