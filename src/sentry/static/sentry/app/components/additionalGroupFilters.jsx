import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import Duration from '../components/duration';
import IndicatorStore from '../stores/indicatorStore';
import {t} from '../locale';

const FilterRuleRow = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    onDelete: React.PropTypes.func.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false
    };
  },

  onDelete() {
    /* eslint no-alert:0*/
    if (!confirm('Are you sure you want to remove this rule?')) return;
    if (this.state.loading) return;

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
            <a className="btn btn-sm btn-default" href={editLink}>{t('Edit Rule')}</a>
            <a className="btn btn-sm btn-default" onClick={this.onDelete}>
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
                  <h6>
                    When <strong>{data.actionMatch}</strong> of these conditions are met:
                  </h6>
                  <table className="conditions-list table">
                    {data.conditions.map((condition, i) => {
                      return (
                        <tr key={i}>
                          <td>{condition.name}</td>
                        </tr>
                      );
                    })}
                  </table>
                </div>}
            </div>
            <div className="col-md-6">
              {data.actions.length !== 0 &&
                <div>
                  <h6>
                    Take these actions at most
                    {' '}
                    <strong>once every <Duration seconds={data.frequency * 60} /></strong>
                    {' '}
                    for an issue:
                  </h6>
                  <table className="actions-list table">
                    {data.actions.map((action, i) => {
                      return (
                        <tr key={i}>
                          <td>{action.name}</td>
                        </tr>
                      );
                    })}
                  </table>
                </div>}
            </div>
          </div>
        </div>
      </div>
    );
  }
});

const AdditionalGroupFilters = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  getInitialState() {
    return {
      fiterRules: []
    };
  },

  renderFilterRules() {
    let {filterRules} = this.state;
    return (
      <div>
        {filterRules.map(rule => {
          <FilterRuleRow />;
        })}
      </div>
    );
  },

  onFilterSave(evt) {
    evt.preventDefault();
    let data = {
      filterType: this.state.filterType,
      filterValue: this.state.filterValue
    };
    alert('save!');
    console.log(data);
    // TODO: some api call that sends this data to some endpoint
  },

  handleTypeChange(event) {
    this.setState({filterType: event.target.value});
  },
  handleValueChange(event) {
    this.setState({filterValue: event.target.value.toLowerCase()});
  },

  render() {
    let taskList = ['environment', 'release', 'error class', 'hostname'];
    return (
      <div>
        {this.renderFilterRules}
        <div className="box">
          <div className="box-header">
            <div className="pull-left">New Filter</div>
          </div>
          <div className="box-content with-padding">
            <div className="row">
              <div className="col-md-6">
                <div>
                  <table className="conditions-list table">
                    <tr>
                      <form onSubmit={this.onFilterSave}>
                        <fieldset>
                          When
                          {' '}
                          <select
                            className="form-control"
                            onChange={this.handleTypeChange}>
                            {taskList.map(task => {
                              return <option key={task} value={task}>{task}</option>;
                            })}
                          </select>
                          {' '}
                          is:
                          <input
                            type="text"
                            name="name"
                            onChange={this.handleValueChange}
                          />
                        </fieldset>
                        <button className="btn btn-sm btn-default" type="submit">
                          {t('Save Filter')}
                        </button>
                      </form>
                    </tr>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default AdditionalGroupFilters;
