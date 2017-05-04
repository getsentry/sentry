import React from 'react';
import DocumentTitle from 'react-document-title';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

const AuthorizationRow = React.createClass({
  propTypes: {
    authorization: React.PropTypes.object.isRequired,
    onRevoke: React.PropTypes.func.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false
    };
  },

  onRevoke() {
    if (this.state.loading) return;

    let {authorization} = this.props;

    this.setState(
      {
        loading: true
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
          }
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
          {authorization.homepageUrl &&
            <div style={{marginBottom: 5}}>
              <small>
                <a href={authorization.homepageUrl}>{authorization.homepageUrl}</a>
              </small>
            </div>}
          <div>
            <small style={{color: '#999'}}>{authorization.scopes.join(', ')}</small>
          </div>
        </td>
        <td style={{width: 32}}>
          <a
            onClick={this.onRevoke.bind(this, authorization)}
            className={btnClassName}
            disabled={this.state.loading}>
            <span className="icon icon-trash" />
          </a>
        </td>
      </tr>
    );
  }
});

const AccountAuthorizations = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      authorizationList: []
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    this.setState({
      loading: true
    });

    this.api.request('/api-authorizations/', {
      success: (data, _, jqXHR) => {
        this.setState({
          loading: false,
          error: false,
          authorizationList: data
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  onRevoke(authorization) {
    this.setState({
      authorizationList: this.state.authorizationList.filter(
        a => a.id !== authorization.id
      )
    });
  },

  renderResults() {
    let {authorizationList} = this.state;
    if (authorizationList.length === 0) {
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
            {authorizationList.map(authorization => {
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
  },

  getTitle() {
    return 'Approved Applications - Sentry';
  },

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          {this.state.loading
            ? <LoadingIndicator />
            : this.state.error
                ? <LoadingError onRetry={this.fetchData} />
                : this.renderResults()}
          <p>
            <small>
              You can manage your own applications via the
              {' '}
              <a href="/api/">API dashboard</a>
              .
            </small>
          </p>
        </div>
      </DocumentTitle>
    );
  }
});

export default AccountAuthorizations;
