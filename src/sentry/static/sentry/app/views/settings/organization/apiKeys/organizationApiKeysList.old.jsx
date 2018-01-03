import PropTypes from 'prop-types';
import React from 'react';

import {t} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import ExternalLink from '../../../../components/externalLink';
import Link from '../../../../components/link';
import LinkWithConfirmation from '../../../../components/linkWithConfirmation';
import SentryTypes from '../../../../proptypes';
import SpreadLayout from '../../../../components/spreadLayout';
import recreateRoute from '../../../../utils/recreateRoute';

class OrganizationApiKeysList extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    routes: PropTypes.array,
    keys: PropTypes.array,
    busy: PropTypes.bool,
    onRemove: PropTypes.func,
    onAddApiKey: PropTypes.func,
  };

  render() {
    let {params, routes, keys, busy, onAddApiKey, onRemove} = this.props;

    return (
      <div>
        <SpreadLayout className="page-header">
          <h3>{t('Api Keys')}</h3>

          <Button
            type="button"
            priority="primary"
            busy={busy}
            disabled={busy}
            onClick={onAddApiKey}
          >
            New API Key
          </Button>
        </SpreadLayout>

        <p>
          API keys grant access to the{' '}
          <ExternalLink
            target="_blank"
            rel="nofollow"
            href="https://docs.sentry.io/hosted/api/"
          >
            developer web API
          </ExternalLink>
          . If you're looking to configure a Sentry client, you'll need a client key which
          is available in your project settings.
        </p>

        <div className="alert alert-block alert-info">
          psst. Until Sentry supports OAuth, you might want to switch to using{' '}
          <Link to="/api/">Auth Tokens</Link> instead.
        </div>

        {keys && (
          <table className="table api-key-list">
            <colgroup>
              <col style={{width: '40%'}} />
              <col style={{width: '40%'}} />
              <col style={{width: '20%'}} />
            </colgroup>
            <tbody>
              {keys.map(({id, key, label}) => {
                let apiDetailsUrl = recreateRoute(`${id}/`, {
                  params,
                  routes,
                });
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
                        onConfirm={e => onRemove(id, e)}
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

        {!keys && (
          <div className="blankslate well">
            There are no API keys for this organization.
          </div>
        )}
      </div>
    );
  }
}

export default OrganizationApiKeysList;
