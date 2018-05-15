import PropTypes from 'prop-types';
import React from 'react';

import {CSRF_COOKIE_NAME} from 'app/constants';
import {t, tct} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/externalLink';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import getCookie from 'app/utils/getCookie';

import ProviderItem from './providerItem';

class OrganizationAuthList extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  static propTypes = {
    providerList: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
  };

  render() {
    let {organization} = this.context;
    let {providerList} = this.props;
    let hasProviderList = providerList && !!providerList.length;

    return (
      <div className="sso">
        <SettingsPageHeader title="Authentication" />
        <Panel>
          <PanelHeader>{t('Choose a provider')}</PanelHeader>
          <PanelBody>
            <PanelAlert m={0} mb={0} type="info">
              {tct(
                `Get started with Single Sign-on for your organization by selecting a
              provider. For more information on SSO please see our [link:documentation]`,
                {
                  link: <ExternalLink href="https://docs.sentry.io/learn/sso/" />,
                }
              )}.
            </PanelAlert>

            <form
              action={`/organizations/${organization.slug}/auth/configure/`}
              method="POST"
            >
              <input
                type="hidden"
                name="csrfmiddlewaretoken"
                value={getCookie(CSRF_COOKIE_NAME)}
              />
              <input type="hidden" name="init" value="1" />

              {hasProviderList &&
                providerList.map(([providerKey, providerName]) => (
                  <ProviderItem
                    key={providerKey}
                    providerKey={providerKey}
                    providerName={providerName}
                  />
                ))}
            </form>

            {!hasProviderList && (
              <EmptyMessage style={{padding: 50, textAlign: 'center'}}>
                {t('No authentication providers are available.')}
              </EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default OrganizationAuthList;
