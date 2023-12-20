import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import AlertLink from 'sentry/components/alertLink';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import {InternalAppApiToken, Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  organization: Organization;
} & DeprecatedAsyncView['props'];

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
        tokenList: state.tokenList?.filter(tk => tk.token !== token.token) ?? [],
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
    const {organization} = this.props;
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
        <AlertLink to={`/settings/${organization?.slug ?? ''}/auth-tokens/`}>
          {t(
            "User Auth Tokens are tied to the logged in user, meaning they'll stop working if the user leaves the organization! We suggest using Organization Auth Tokens to create/manage tokens tied to the organization instead."
          )}
        </AlertLink>
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
                key={token.token}
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

export default withOrganization(ApiTokens);
