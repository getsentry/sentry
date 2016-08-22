import React from 'react';
import DocumentTitle from 'react-document-title';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import AutoSelectText from '../components/autoSelectText';
import IndicatorStore from '../stores/indicatorStore';
import ListLink from '../components/listLink';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import NarrowLayout from '../components/narrowLayout';
import {t, tct} from '../locale';

const ApiTokenRow = React.createClass({
  propTypes: {
    token: React.PropTypes.object.isRequired,
    onRemove: React.PropTypes.func.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
    };
  },

  onRemove() {
    if (this.state.loading) return;

    let token = this.props.token;

    this.setState({
      loading: true,
    }, () => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
      this.api.request('/api-tokens/', {
        method: 'DELETE',
        data: {token: token.token},
        success: (data) => {
          this.props.onRemove();
        },
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },

  render() {
    let token = this.props.token;

    let btnClassName = 'btn btn-default';
    if (this.state.loading)
      btnClassName += ' disabled';

    return (
      <tr>
        <td>
          <small><AutoSelectText>{token.token}</AutoSelectText></small>
          <small style={{color: '#999'}}>{token.scopes.join(', ')}</small>
        </td>
        <td style={{width: 32}}>
          <a onClick={this.onRemove.bind(this, token)}
             className={btnClassName}
             disabled={this.state.loading}>
            <span className="icon icon-trash" />
          </a>
        </td>
      </tr>
    );
  }
});

const ApiDashboard = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      tokenList: [],
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
      loading: true,
    });

    this.api.request('/api-tokens/', {
      success: (data, _, jqXHR) => {
        this.setState({
          loading: false,
          error: false,
          tokenList: data
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      }
    });
  },

  onRemoveToken(token) {
    this.setState({
      tokenList: this.state.tokenList.filter((tk) => tk.token !== token.token),
    });
  },

  renderResults() {
    if (this.state.tokenList.length === 0) {
      return (
        <tr colSpan="2">
          <td className="blankslate well">
            {t('You haven\'t created any authentication tokens yet.')}
          </td>
        </tr>
      );
    }

    return this.state.tokenList.map((token) => {
      return (
        <ApiTokenRow
          key={token.token}
          token={token}
          onRemove={this.onRemoveToken.bind(this, token)} />
      );
    });
  },

  getTitle() {
    return 'Sentry API';
  },

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <NarrowLayout>
          <h3>{t('Sentry Web API')}</h3>
          <ul className="nav nav-tabs border-bottom">
            <ListLink to="/api/">{t('Auth Tokens')}</ListLink>
          </ul>
          <p>{t('Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They\'re the easiest way to get started using the API.')}</p>
          <p>{tct('For more information on how to use the web API, see our [link:documentation].', {
            link: <a href="https://docs.sentry.io/hosted/api/" />
          })}</p>

          <p><small>psst. Looking for the <strong>DSN</strong> for an SDK? You'll find that under <strong>[Project] &raquo; Settings &raquo; Client Keys</strong>.</small></p>

          <table className="table">
            <tbody>
              {(this.state.loading ?
                <tr><td colSpan="2"><LoadingIndicator /></td></tr>
              : (this.state.error ?
                <tr><td colSpan="2"><LoadingError onRetry={this.fetchData} /></td></tr>
              :
                this.renderResults()
              ))}
            </tbody>
          </table>

          <div className="form-actions" style={{textAlign: 'right'}}>
            <Link to="/api/new-token/" className="btn btn-primary">{t('Create New Token')}</Link>
          </div>
        </NarrowLayout>
      </DocumentTitle>
    );
  }
});

export default ApiDashboard;

