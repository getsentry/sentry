import React from 'react';
import DocumentTitle from 'react-document-title';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import AutoSelectText from '../components/autoSelectText';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import NarrowLayout from '../components/narrowLayout';
import {t, tct} from '../locale';

const ApiApplicationRow = React.createClass({
  propTypes: {
    app: React.PropTypes.object.isRequired,
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

    let app = this.props.app;

    this.setState({
      loading: true,
    }, () => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
      this.api.request(`/api-applications/${app.id}`, {
        method: 'DELETE',
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
    let app = this.props.app;

    let btnClassName = 'btn btn-default';
    if (this.state.loading)
      btnClassName += ' disabled';

    return (
      <tr>
        <td>
          <small><AutoSelectText>{app.clientID}</AutoSelectText></small>
          <small style={{color: '#999'}}>{app.clientSecret}</small>
        </td>
        <td style={{width: 32}}>
          <a onClick={this.onRemove.bind(this, app)}
             className={btnClassName}
             disabled={this.state.loading}>
            <span className="icon icon-trash" />
          </a>
        </td>
      </tr>
    );
  }
});

const ApiApplications = React.createClass({
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
          appList: data
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

  createApplication() {
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request('/api-applications/', {
      success: (app) => {
        IndicatorStore.remove(loadingIndicator);
        this.history.pushState(null, `/api/applications/${app.id}/`);
      },
      error: (error) => {
        IndicatorStore.add(t('Unable to disable plugin. Please try again.'), 'error');
      }
    });
  }

  onRemoveApplication(app) {
    this.setState({
      appList: this.state.appList.filter((a) => a.id !== app.id),
    });
  },

  renderResults() {
    if (this.state.appList.length === 0) {
      return (
        <tr colSpan="2">
          <td className="blankslate well">
            {t('You haven\'t created any applications yet.')}
          </td>
        </tr>
      );
    }

    return this.state.appList.map((app) => {
      return (
        <ApiApplicationRow
          key={app.id}
          app={app}
          onRemove={this.onRemoveApplication.bind(this, app)} />
      );
    });
  },

  getTitle() {
    return 'API Applications - Sentry';
  },

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
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
            <a className="btn btn-primary"
               onClick={this.createApplication}>{t('Create New Application')}</a>
          </div>
        </div>
      </DocumentTitle>
    );
  }
});

export default ApiApplications;
