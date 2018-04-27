import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import AsyncView from 'app/views/asyncView';
import ApiMixin from 'app/mixins/apiMixin';
import IndicatorStore from 'app/stores/indicatorStore';
import {t} from 'app/locale';

const AuthorizationRow = createReactClass({
  displayName: 'AuthorizationRow',

  propTypes: {
    authorization: PropTypes.object.isRequired,
    onRevoke: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
    };
  },

  onRevoke() {
    if (this.state.loading) return;

    let {authorization} = this.props;

    this.setState(
      {
        loading: true,
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        this.api.request('/api-authorizations/', {
          method: 'DELETE',
          data: {authorization: authorization.id},
          success: data => {
            IndicatorStore.remove(loadingIndicator);
            this.props.onRevoke();
          },
          error: () => {
            IndicatorStore.remove(loadingIndicator);
            IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error');
          },
        });
      }
    );
  },

  render() {
    let authorization = this.props.authorization;

    let btnClassName = 'btn btn-default';
    if (this.state.loading) btnClassName += ' disabled';

    return (
      <tr>
        <td>
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
        </td>
        <td style={{width: 32}}>
          <a
            onClick={this.onRevoke.bind(this, authorization)}
            className={btnClassName}
            disabled={this.state.loading}
          >
            <span className="icon icon-trash" />
          </a>
        </td>
      </tr>
    );
  },
});

class AccountAuthorizations extends AsyncView {
  getEndpoint() {
    return '/api-authorizations/';
  }

  getTitle() {
    return 'Approved Applications';
  }

  onRevoke(authorization) {
    this.setState({
      data: this.state.data.filter(a => a.id !== authorization.id),
    });
  }

  renderResults() {
    let {data} = this.state;
    if (data.length === 0) {
      return (
        <table className="table">
          <tbody>
            <tr colSpan="2">
              <td className="blankslate well">
                {t("You haven't approved any third party applications.")}
              </td>
            </tr>
          </tbody>
        </table>
      );
    }

    return (
      <div>
        <h4>Approved Applications</h4>
        <table className="table">
          <tbody>
            {data.map(authorization => {
              return (
                <AuthorizationRow
                  key={authorization.id}
                  authorization={authorization}
                  onRevoke={this.onRevoke.bind(this, authorization)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  renderBody() {
    return (
      <div>
        {this.renderResults()}
        <p>
          <small>
            You can manage your own applications via the <a href="/api/">API dashboard</a>
            .
          </small>
        </p>
      </div>
    );
  }
}

export default AccountAuthorizations;
