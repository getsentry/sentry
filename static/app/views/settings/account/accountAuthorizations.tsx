import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ApiApplication} from 'sentry/types';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Authorization = {
  application: ApiApplication;
  homepageUrl: string;
  id: string;
  scopes: string[];
};

type Props = RouteComponentProps<{}, {}>;

type State = {
  data: Authorization[];
} & DeprecatedAsyncView['state'];

class AccountAuthorizations extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
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
                          <ExternalLink href={authorization.homepageUrl}>
                            {authorization.homepageUrl}
                          </ExternalLink>
                        </Url>
                      )}
                      <Scopes>{authorization.scopes.join(', ')}</Scopes>
                    </ApplicationDetails>
                    <Button
                      size="sm"
                      onClick={() => this.handleRevoke(authorization)}
                      icon={<IconDelete />}
                      aria-label={t('Delete')}
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
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;
