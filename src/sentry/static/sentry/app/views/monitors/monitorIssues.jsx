import React, {Component} from 'react';
import PropTypes from 'prop-types';

import IssueList from 'app/components/issueList';
import {t} from 'app/locale';

export default class MonitorIssues extends Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    monitor: PropTypes.object.isRequired,
  };

  getIssuesPath() {
    const {orgId} = this.props;
    return `/organizations/${orgId}/issues/`;
  }

  render() {
    const {monitor, orgId} = this.props;

    return (
      <IssueList
        endpoint={this.getIssuesPath()}
        query={{
          query: 'monitor.id:"' + monitor.id + '"',
          project: monitor.project.id,
          limit: 5,
        }}
        statsPeriod="0"
        pagination={false}
        emptyText={t('No issues found')}
        showActions={false}
        noBorder
        noMargin
        params={{orgId}}
      />
    );
  }
}
