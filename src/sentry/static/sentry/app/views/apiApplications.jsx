import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import DocumentTitle from 'react-document-title';
import {Link} from 'react-router';

import ApiMixin from 'app/mixins/apiMixin';
import IndicatorStore from 'app/stores/indicatorStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';

const ApiApplicationRow = createReactClass({
  displayName: 'ApiApplicationRow',

  propTypes: {
    app: PropTypes.object.isRequired,
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

    let app = this.props.app;

    this.setState(
      {
        loading: true,
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        this.api.request(`/api-applications/${app.id}/`, {
          method: 'DELETE',
          success: data => {
            IndicatorStore.remove(loadingIndicator);
            this.props.onRemove();
          },
          error: () => {
            IndicatorStore.remove(loadingIndicator);
            IndicatorStore.add(
              t('Unable to remove application. Please try again.'),
              'error',
              {
                duration: 3000,
              }
            );
          },
        });
      }
    );
  },

  render() {
    let app = this.props.app;

    let btnClassName = 'btn btn-default';
    if (this.state.loading) btnClassName += ' disabled';

    return (
      <tr>
        <td>
          <h4 style={{marginBottom: 5}}>
            <Link to={`/api/applications/${app.id}/`}>{app.name}</Link>
          </h4>
          <small style={{color: '#999'}}>{app.clientID}</small>
        </td>
        <td style={{width: 32}}>
          <a
            onClick={this.onRemove.bind(this, app)}
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

const ApiApplications = createReactClass({
  displayName: 'ApiApplications',

  contextTypes: {
    router: PropTypes.object.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      appList: [],
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

    this.api.request('/api-applications/', {
      success: (data, _, jqXHR) => {
        this.setState({
          loading: false,
          error: false,
          appList: data,
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

  createApplication() {
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request('/api-applications/', {
      method: 'POST',
      success: app => {
        IndicatorStore.remove(loadingIndicator);
        this.context.router.push(`/api/applications/${app.id}/`);
      },
      error: error => {
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(t('Unable to remove application. Please try again.'), 'error');
      },
    });
  },

  onRemoveApplication(app) {
    this.setState({
      appList: this.state.appList.filter(a => a.id !== app.id),
    });
  },

  renderResults() {
    if (this.state.appList.length === 0) {
      return (
        <tr colSpan="2">
          <td className="blankslate well">
            {t("You haven't created any applications yet.")}
          </td>
        </tr>
      );
    }

    return this.state.appList.map(app => {
      return (
        <ApiApplicationRow
          key={app.id}
          app={app}
          onRemove={this.onRemoveApplication.bind(this, app)}
        />
      );
    });
  },

  getTitle() {
    return 'API Applications';
  },

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          <table className="table">
            <tbody>
              {this.state.loading ? (
                <tr>
                  <td colSpan="2">
                    <LoadingIndicator />
                  </td>
                </tr>
              ) : this.state.error ? (
                <tr>
                  <td colSpan="2">
                    <LoadingError onRetry={this.fetchData} />
                  </td>
                </tr>
              ) : (
                this.renderResults()
              )}
            </tbody>
          </table>

          <div className="form-actions" style={{textAlign: 'right'}}>
            <a
              className="btn btn-primary ref-create-application"
              onClick={this.createApplication}
            >
              {t('Create New Application')}
            </a>
          </div>
        </div>
      </DocumentTitle>
    );
  },
});

export default ApiApplications;
