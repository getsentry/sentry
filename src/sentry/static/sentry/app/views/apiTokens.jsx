import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import DocumentTitle from 'react-document-title';
import {Link} from 'react-router';

import ApiMixin from 'app/mixins/apiMixin';
import AutoSelectText from 'app/components/autoSelectText';
import DateTime from 'app/components/dateTime';
import IndicatorStore from 'app/stores/indicatorStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tct} from 'app/locale';

const ApiTokenRow = createReactClass({
  displayName: 'ApiTokenRow',

  propTypes: {
    token: PropTypes.object.isRequired,
    onRemove: PropTypes.func.isRequired,
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

    this.setState(
      {
        loading: true,
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        this.api.request('/api-tokens/', {
          method: 'DELETE',
          data: {token: token.token},
          success: data => {
            IndicatorStore.remove(loadingIndicator);
            this.props.onRemove();
          },
          error: () => {
            IndicatorStore.remove(loadingIndicator);
            IndicatorStore.add(t('Unable to remove token. Please try again.'), 'error');
          },
        });
      }
    );
  },

  render() {
    let token = this.props.token;

    let btnClassName = 'btn btn-default';
    if (this.state.loading) btnClassName += ' disabled';

    return (
      <tr>
        <td>
          <div style={{marginBottom: 5}}>
            <small>
              <AutoSelectText>{token.token}</AutoSelectText>
            </small>
          </div>
          <div style={{marginBottom: 5}}>
            <small>
              Created <DateTime date={token.dateCreated} />
            </small>
          </div>
          <div>
            <small style={{color: '#999'}}>{token.scopes.join(', ')}</small>
          </div>
        </td>
        <td style={{width: 32}}>
          <a
            onClick={this.onRemove.bind(this, token)}
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

const ApiTokens = createReactClass({
  displayName: 'ApiTokens',
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
          tokenList: data,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  onRemoveToken(token) {
    this.setState({
      tokenList: this.state.tokenList.filter(tk => tk.token !== token.token),
    });
  },

  renderResults() {
    let {tokenList} = this.state;

    if (tokenList.length === 0) {
      return (
        <table className="table">
          <tbody>
            <tr colSpan="2">
              <td className="blankslate well">
                {t("You haven't created any authentication tokens yet.")}
              </td>
            </tr>
          </tbody>
        </table>
      );
    }

    return (
      <div>
        <table className="table">
          <tbody>
            {tokenList.map(token => {
              return (
                <ApiTokenRow
                  key={token.token}
                  token={token}
                  onRemove={this.onRemoveToken.bind(this, token)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },

  getTitle() {
    return 'API Tokens';
  },

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          <p>
            {t(
              "Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
            )}
          </p>
          <p>
            {tct(
              'For more information on how to use the web API, see our [link:documentation].',
              {
                link: <a href="https://docs.sentry.io/hosted/api/" />,
              }
            )}
          </p>

          <p>
            <small>
              psst. Looking for the <strong>DSN</strong> for an SDK? You'll find that
              under <strong>[Project] » Settings » Client Keys</strong>
              .
            </small>
          </p>

          {this.state.loading ? (
            <LoadingIndicator />
          ) : this.state.error ? (
            <LoadingError onRetry={this.fetchData} />
          ) : (
            this.renderResults()
          )}

          <div className="form-actions" style={{textAlign: 'right'}}>
            <Link to="/api/new-token/" className="btn btn-primary ref-create-token">
              {t('Create New Token')}
            </Link>
          </div>
        </div>
      </DocumentTitle>
    );
  },
});

export default ApiTokens;
