import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import type {InternalAppApiToken} from 'sentry/types';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = DeprecatedAsyncView['props'];

type State = {
  tokenList: InternalAppApiToken[] | null;
} & DeprecatedAsyncView['state'];

export class ApiTokens extends DeprecatedAsyncView<Props, State> {
  getTitle() {
    return t('User Auth Tokens');
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      tokenList: [],
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    return [['tokenList', '/api-tokens/']];
  }

  handleRemoveToken = (token: InternalAppApiToken) => {
    addLoadingMessage();
    const oldTokenList = this.state.tokenList;

    this.setState(
      state => ({
        tokenList: state.tokenList?.filter(tk => tk.id !== token.id) ?? [],
      }),
      async () => {
        try {
          await this.api.requestPromise('/api-tokens/', {
            method: 'DELETE',
            data: {tokenId: token.id},
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

    const isEmpty = !Array.isArray(tokenList) || tokenList.length === 0;

    const action = (
      <Button
        priority="primary"
        size="sm"
        to="/settings/account/api/auth-tokens/new-token/"
        data-test-id="create-token"
      >
        {t('Create New Token')}
      </Button>
    );

    return (
      <div>
        <SettingsPageHeader title={this.getTitle()} action={action} />
        <TextBlock>
          {t(
            "Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
          )}
        </TextBlock>
        <TextBlock>
          {tct(
            'For more information on how to use the web API, see our [link:documentation].',
            {
              link: <ExternalLink href="https://docs.sentry.io/api/" />,
            }
          )}
        </TextBlock>
        <Panel>
          <PanelHeader>{t('Auth Token')}</PanelHeader>

          <PanelBody>
            {isEmpty && (
              <EmptyMessage>
                {t("You haven't created any authentication tokens yet.")}
              </EmptyMessage>
            )}

            {tokenList?.map(token => (
              <ApiTokenRow
                key={token.id}
                token={token}
                onRemove={this.handleRemoveToken}
              />
            ))}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default ApiTokens;
