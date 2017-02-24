import React from 'react';
import DocumentTitle from 'react-document-title';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import AutoSelectText from '../components/autoSelectText';
import DateTime from '../components/dateTime';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t, tct} from '../locale';
import {sortArray} from '../utils';

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

    if (token.application) {
      return (
        <tr>
          <td>
            <h5 style={{marginBottom: 5}}>{token.application.name}</h5>
            {token.homepageUrl &&
              <div style={{marginBottom: 5}}>
                <small><a href={token.homepageUrl}>{token.homepageUrl}</a></small>
              </div>
            }
            <div style={{marginBottom: 5}}>
              <small>Created <DateTime value={token.dateCreated} /></small>
            </div>
            <div>
              <small style={{color: '#999'}}>{token.scopes.join(', ')}</small>
            </div>
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

    return (
      <tr>
        <td>
          <div style={{marginBottom: 5}}>
            <small><AutoSelectText>{token.token}</AutoSelectText></small>
          </div>
          <div style={{marginBottom: 5}}>
            <small>Created <DateTime value={token.dateCreated} /></small>
          </div>
          <div>
            <small style={{color: '#999'}}>{token.scopes.join(', ')}</small>
          </div>
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

const ApiTokens = React.createClass({
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

    let appTokens = [];
    let myTokens = [];
    this.state.tokenList.forEach((token) => {
      if (token.application) {
        appTokens.push(token);
      } else {
        myTokens.push(token);
      }
    });

    return (
      <div>
        {myTokens.length !== 0 &&
          <div>
            <h4>My Tokens</h4>
            <table className="table">
              <tbody>
              {myTokens.map((token) => {
                return <ApiTokenRow
                  key={token.token}
                  token={token}
                  onRemove={this.onRemoveToken.bind(this, token)} />;
              })}
              </tbody>
            </table>
          </div>
        }
        {appTokens.length !== 0 &&
          <div>
            <h4>Applications</h4>
            <table className="table">
              <tbody>
              {appTokens.map((token) => {
                return <ApiTokenRow
                  key={token.token}
                  token={token}
                  onRemove={this.onRemoveToken.bind(this, token)} />;
              })}
              </tbody>
            </table>
          </div>
        }
      </div>
    );
  },

  getTitle() {
    return 'API Tokens - Sentry';
  },

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          <p>{t('Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They\'re the easiest way to get started using the API.')}</p>
          <p>{tct('For more information on how to use the web API, see our [link:documentation].', {
            link: <a href="https://docs.sentry.io/hosted/api/" />
          })}</p>

          <p><small>psst. Looking for the <strong>DSN</strong> for an SDK? You'll find that under <strong>[Project] &raquo; Settings &raquo; Client Keys</strong>.</small></p>

          {(this.state.loading ?
            <LoadingIndicator />
          : (this.state.error ?
            <LoadingError onRetry={this.fetchData} />
          :
            this.renderResults()
          ))}

          <div className="form-actions" style={{textAlign: 'right'}}>
            <Link to="/api/new-token/" className="btn btn-primary">{t('Create New Token')}</Link>
          </div>
        </div>
      </DocumentTitle>
    );
  }
});

export default ApiTokens;
