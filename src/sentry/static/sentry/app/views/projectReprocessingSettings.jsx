import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import {t} from '../locale';

const ProjectReprocessingSettings = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {};
  },

  componentWillMount() {
    this.props.setProjectNavSection('settings');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    let location = this.props.location;
    let nextLocation = nextProps.location;
    if (location.pathname != nextLocation.pathname || location.search != nextLocation.search) {
      this.remountComponent();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
  },

  renderIssue(item) {
    let rv = [];
    let idx = 0;
    for (let error of item.errors) {
      idx++;
      if (error === 'dsym') {
        rv.push(<span className="error" key={idx}>Missing Debug Symbols</span>);
      } else if (error === 'noitc') {
        rv.push(<span className="warning" key={idx}>No iTunes Connect Integration</span>);
      } else if (error === 'sourcemaps') {
        rv.push(<span className="error" key={idx}>Missing Sourcemaps</span>);
      }
    }
    return <span className="status-tags">{rv}</span>;
  },

  render() {
    let data = [
      {
        name: 'Release A',
        events: 42,
        errors: ['dsym', 'noitc'],
      },
      {
        name: 'Release B',
        events: 21,
        errors: ['sourcemaps'],
      }
    ];

    return (
      <div>
        <h1>{t('On-Hold Event Reprocessing')}</h1>
        <p>
          Some events encountered issues on processing due to misconfiguration
          and were put on hold.  You can choose to discard these events,
          to fix the configuration issue which will cause reprocessing or
          to view them to decide what to do with them.
        </p>
        <p>
          Click on one of the identified issues to learn more about how to
          fix the underlying problem.
        </p>

        <table className="table">
          <thead>
            <tr>
              <th>Release</th>
              <th>Identified Issues</th>
              <th>Affected Events</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={idx}>
                <td><a href="">{item.name}</a></td>
                <td>{this.renderIssue(item)}</td>
                <td>{item.events + ''}</td>
                <td><div className="btn-group btn-group-sm">
                  <button className="btn btn-small btn-primary">Discard</button>
                  <button className="btn btn-small btn-primary">Accept</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
});

export default ProjectReprocessingSettings;
