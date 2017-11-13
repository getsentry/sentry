import React from 'react';
import {browserHistory} from 'react-router';

import {Client} from '../../../../api';
import {t} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import Link from '../../../../components/link';
import LinkWithConfirmation from '../../../../components/linkWithConfirmation';
import SentryTypes from '../../../../proptypes';
import SpreadLayout from '../../../../components/spreadLayout';
import OrganizationSettingsView from '../../../organizationSettingsView';

class OrganizationApiKeysView extends OrganizationSettingsView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  getEndpoints() {
    return [['keys', `/organizations/${this.props.params.orgId}/api-keys/`]];
  }

  getTitle() {
    let org = this.context.organization;
    return `${org.name} API Keys`;
  }

  handleRemove = (id, e) => {
    const api = new Client();
    api.request(`/organizations/${this.props.params.orgId}/api-keys/${id}/`, {
      method: 'DELETE',
      data: {},
      success: data => {
        this.setState(state => ({
          keys: state.keys.filter(({id: existingId}) => existingId !== id),
        }));
      },
      error: () => {
        this.setState({busy: false});
      },
    });
  };

  handleAddApiKey = () => {
    const api = new Client();
    this.setState({
      busy: true,
    });
    api.request(`/organizations/${this.props.params.orgId}/api-keys/`, {
      method: 'POST',
      data: {},
      success: data => {
        this.setState({busy: false});
        browserHistory.push(
          `/organizations/${this.props.params.orgId}/api-keys/${data.id}`
        );
      },
      error: () => {
        this.setState({busy: false});
      },
    });
  };

  renderBody() {
    let keyList = this.state.keys;

    return (
      <div>
        <SpreadLayout className="page-header">
          <h3>{t('Api Keys')}</h3>

          <Button
            type="button"
            priority="primary"
            busy={this.state.busy}
            disabled={this.state.busy}
            onClick={this.handleAddApiKey}
          >
            New API Key
          </Button>
        </SpreadLayout>

        <p>
          API keys grant access to the{' '}
          <a target="_blank" rel="nofollow" href="https://docs.sentry.io/hosted/api/">
            developer web API
          </a>
          . If you're looking to configure a Sentry client, you'll need a client key which
          is available in your project settings.
        </p>

        <div className="alert alert-block alert-info">
          psst. Until Sentry supports OAuth, you might want to switch to using{' '}
          <Link to="/api/">Auth Tokens</Link> instead.
        </div>

        {keyList && (
          <table className="table api-key-list">
            <colgroup>
              <col style={{width: '40%'}} />
              <col style={{width: '40%'}} />
              <col style={{width: '20%'}} />
            </colgroup>
            <tbody>
              {keyList.map(({id, key, label}) => {
                let apiDetailsUrl = `/organizations/${this.props.params
                  .orgId}/api-keys/${id}`;
                return (
                  <tr key={key}>
                    <td>
                      <h5>
                        <Link to={apiDetailsUrl}>{label}</Link>
                      </h5>
                    </td>
                    <td>
                      <div className="form-control disabled auto-select">{key}</div>
                    </td>
                    <td className="align-right">
                      <Link
                        to={apiDetailsUrl}
                        className="btn btn-default btn-sm"
                        style={{marginRight: 4}}
                      >
                        Edit Key
                      </Link>
                      <LinkWithConfirmation
                        className="btn btn-default btn-sm"
                        onConfirm={this.handleRemove.bind(this, id)}
                        message="Are you sure you want to remove this API key?"
                        title="Remove API Key?"
                      >
                        <span className="icon-trash" />
                      </LinkWithConfirmation>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!keyList && (
          <div className="blankslate well">
            There are no API keys for this organization.
          </div>
        )}
      </div>
    );
  }
}

export default OrganizationApiKeysView;
