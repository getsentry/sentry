import PropTypes from 'prop-types';
import React from 'react';

import {Panel, PanelBody} from 'app/components/panels';
import CompactIssue from 'app/components/issues/compactIssue';
import AsyncComponent from 'app/components/asyncComponent';

export default class BuildIssues extends AsyncComponent {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    build: PropTypes.object.isRequired,
  };

  getEndpoints() {
    return [
      [
        'issueList',
        `/organizations/${this.props.orgId}/issues/`,
        {query: {query: 'build.id:"' + this.props.build.buildId + '"'}},
      ],
    ];
  }

  renderBody() {
    return (
      <Panel style={{border: 0, borderRadius: 0, marginBottom: 0}}>
        <PanelBody className="issue-list">
          {this.state.issueList.map(issue => {
            return (
              <CompactIssue
                key={issue.id}
                id={issue.id}
                data={issue}
                statsPeriod=""
                showActions={false}
              />
            );
          })}
        </PanelBody>
      </Panel>
    );
  }
}
