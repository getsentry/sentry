import React, {Component} from 'react';
import PropTypes from 'prop-types';

import IssueList from 'app/components/issueList';
import {t} from 'app/locale';

export default class BuildIssues extends Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    build: PropTypes.object.isRequired,
  };

  getIssuesPath() {
    const {orgId} = this.props;
    return `/organizations/${orgId}/issues/`;
  }

  render() {
    const {build, orgId} = this.props;

    return (
      <IssueList
        endpoint={this.getIssuesPath()}
        query={{
          query: 'build.id:"' + build.buildId + '"',
          limit: 5,
        }}
        statsPeriod="0"
        pagination={false}
        emptyText={t('No issues found')}
        showActions={false}
        noBorder={true}
        noMargin={true}
        params={{orgId}}
      />
    );
  }
}
