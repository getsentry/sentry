import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import Duration from '../components/duration';
import IndicatorStore from '../stores/indicatorStore';
import ListLink from '../components/listLink';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

const RuleRow = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    onDelete: React.PropTypes.func.isRequired,
  },

  mixins: [
    ApiMixin,
  ],

  getInitialState() {
    return {
      loading: false,
      error: false,
    };
  },

  onDelete() {
    /* eslint no-alert:0*/
    if (!confirm('Are you sure you want to remove this rule?'))
      return;
    if (this.state.loading)
      return;

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId, data} = this.props;
    this.api.request(`/projects/${orgId}/${projectId}/rules/${data.id}/`, {
      method: 'DELETE',
      success: (d, _, jqXHR) => {
        this.props.onDelete();
        IndicatorStore.remove(loadingIndicator);
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error');
      }
    });
  },

  render() {
    let {orgId, projectId, data} = this.props;
    let editLink = `/${orgId}/${projectId}/settings/alerts/rules/${data.id}/`;
    return (
      <div className="box">
        <div className="box-header">
          <div className="pull-right">
            <a className="btn btn-sm btn-default"
                href={editLink}>{t('Edit Rule')}</a>
            <a className="btn btn-sm btn-default"
               onClick={this.onDelete}>
              <span className="icon-trash" style={{marginRight: 3}} />
            </a>
          </div>
          <h3><a href={editLink}>{data.name}</a></h3>
        </div>
        <div className="box-content with-padding">
          <div className="row">
            <div className="col-md-6">
              {data.conditions.length !== 0 &&
                <div>
                  <h6>When <strong>{data.actionMatch}</strong> of these conditions are met:</h6>
                  <table className="conditions-list table">
                  {data.conditions.map((condition) => {
                    return (
                      <tr>
                        <td>{condition.name}</td>
                      </tr>
                    );
                  })}
                  </table>
                </div>
              }
            </div>
            <div className="col-md-6">
              {data.actions.length !== 0 &&
                <div>
                  <h6>Take these actions at most <strong>once every <Duration seconds={data.frequency * 60} /></strong> for an issue:</h6>
                  <table className="actions-list table">
                  {data.actions.map((action) => {
                    return (
                      <tr>
                        <td>{action.name}</td>
                      </tr>
                    );
                  })}
                  </table>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    );
  }
});

const ProjectAlertRules = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      ruleList: [],
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/rules/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          ruleList: data
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  onDeleteRule(rule) {
    this.setState({
      ruleList: this.state.ruleList.filter(r => r.id !== rule.id)
    });
  },

  renderBody() {
    let body;

    if (this.state.loading)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.ruleList.length)
      body = this.renderResults();
    else
      body = this.renderEmpty();

    return body;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('There are no alerts configured for this project.')}</p>
      </div>
    );
  },

  renderResults() {
    let {orgId, projectId} = this.props.params;
    return (
      <div className="rules-list">
        {this.state.ruleList.map((rule) => {
          return (
            <RuleRow
              key={rule.id}
              data={rule}
              orgId={orgId}
              projectId={projectId}
              onDelete={this.onDeleteRule.bind(this, rule)} />
          );
        })}
      </div>
    );
  },

  render() {
    let {orgId, projectId} = this.props.params;
    return (
      <div>
        <a href={`/${orgId}/${projectId}/settings/alerts/rules/new/`}
           className="btn pull-right btn-primary btn-sm">
          <span className="icon-plus" />
          {t('New Alert Rule')}
        </a>
        <h2>{t('Alerts')}</h2>

        <ul className="nav nav-tabs" style={{borderBottom: '1px solid #ddd'}}>
          <ListLink to={`/${orgId}/${projectId}/settings/alerts/`}
                    index={true}>{t('Settings')}</ListLink>
          <ListLink to={`/${orgId}/${projectId}/settings/alerts/rules/`}>{t('Rules')}</ListLink>
        </ul>

        {this.renderBody()}
      </div>
    );
  }
});

export default ProjectAlertRules;
