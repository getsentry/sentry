import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from 'app/locale';
import ApiForm from 'app/components/forms/apiForm';
import BooleanField from 'app/components/forms/booleanField';
import Button from 'app/components/buttons/button';
import SelectField from 'app/components/forms/selectField';

const ROLES = [
  ['member', 'Member'],
  ['billing', 'Billing'],
  ['owner', 'Owner'],
  ['admin', 'Admin'],
  ['manager', 'Manager'],
];

class OrganizationAuthProvider extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    onDisableProvider: PropTypes.func.isRequired,
    onSendReminders: PropTypes.func.isRequired,
    sendRemindersBusy: PropTypes.bool,
    provider: PropTypes.shape({
      auth_provider: PropTypes.shape({
        id: PropTypes.string.isRequired,
        provider: PropTypes.string.isRequired,
      }),
      require_link: PropTypes.bool,
      default_role: PropTypes.string,
      login_url: PropTypes.string,
      provider_name: PropTypes.string,
      pending_links_count: PropTypes.number,
      content: PropTypes.string,
    }),
    disableBusy: PropTypes.bool,
  };

  static defaultProps = {
    provider: {},
    onDisableProvider: () => {},
    onSendReminders: () => {},
  };

  render() {
    let {
      orgId,
      provider,
      sendRemindersBusy,
      disableBusy,
      onDisableProvider,
      onSendReminders,
    } = this.props;

    if (!provider) return null;

    let {
      content,
      login_url: loginUrl,
      provider_name: providerName,
      pending_links_count: pendingLinksCount,
    } = provider;

    return (
      <div>
        <h3>{tct('[providerName] Authentication', {providerName})}</h3>

        <div className="box">
          <div className="box-content with-padding">
            <legend style={{marginTop: 0}}>{t('Login URL')}</legend>

            <p>
              {t(
                `While Sentry will try to be clever about directing members to the
              appropriate login form, you're safest just to hit up your
              organization-specific login when visiting the app`
              )}:
            </p>

            <pre>
              <a href={loginUrl}>{loginUrl}</a>
            </pre>

            {!!pendingLinksCount && (
              <div>
                <hr />
                <h4>{t('Unlinked Members')}</h4>

                <Button
                  priority="primary"
                  className="pull-right"
                  busy={sendRemindersBusy}
                  onClick={onSendReminders}
                  style={{marginLeft: 20}}
                >
                  {t('Send Reminders')}
                </Button>

                <p>
                  {tct(
                    `There are currently [pendingLinksCount] member(s) who have
                  not yet linked their account with [providerName]. Until this
                  is done they will be unable to access the organization.`,
                    {pendingLinksCount, providerName}
                  )}
                </p>
              </div>
            )}

            <div dangerouslySetInnerHTML={{__html: content}} />

            <legend>{t('General Settings')}</legend>

            <ApiForm
              apiMethod="PUT"
              initialData={provider}
              apiEndpoint={`/organizations/${orgId}/auth-provider/`}
              onSubmit={() => {}}
              submitLabel={t('Save Settings')}
            >
              <BooleanField
                name="require_link"
                label="Require SSO"
                help="Require members to use a valid linked SSO account to access this organization"
              />
              <SelectField
                name="default_role"
                label="Default Role"
                choices={ROLES}
                required
              />
            </ApiForm>
          </div>
        </div>

        <div className="box">
          <div className="box-header">
            <h3>{tct('Disable [providerName] Authentication', {providerName})}</h3>
          </div>

          <div className="box-content with-padding">
            <p>
              {t(
                `Your organization will no longer being able to authenticate with their
              existing accounts. This will prevent any existing users from logging in
              unless they have access outside of SSO.`
              )}
            </p>

            <fieldset className="form-actions">
              <Button
                priority="danger"
                disabled={disableBusy}
                onClick={() => onDisableProvider(providerName)}
              >
                {tct('Disable [providerName] Auth', {providerName})}
              </Button>
            </fieldset>
          </div>
        </div>
      </div>
    );
  }
}

export default OrganizationAuthProvider;
