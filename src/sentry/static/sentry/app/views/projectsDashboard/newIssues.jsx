import PropTypes from 'prop-types';
import React from 'react';

import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import IssueList from 'app/components/issueList';
import {t} from 'app/locale';
import {IconRefresh} from 'app/icons';

export default class NewIssues extends React.Component {
  static propTypes = {
    statsPeriod: PropTypes.string,
    pageSize: PropTypes.number,
  };

  issueListRef = React.createRef();

  getEndpoint = () => `/organizations/${this.props.params.orgId}/issues/new/`;

  renderEmpty = () => (
    <Panel>
      <PanelBody>
        <PanelItem justifyContent="center">
          {t('No new issues have been seen in the last week.')}
        </PanelItem>
      </PanelBody>
    </Panel>
  );

  refresh = () => {
    this.issueListRef.current.remountComponent();
  };

  render() {
    return (
      <div>
        <div className="pull-right">
          <a
            className="btn btn-sm btn-default"
            style={{marginLeft: 5}}
            onClick={this.refresh}
          >
            <IconRefresh size="xs" />
          </a>
        </div>
        <h4>New this week</h4>
        <IssueList
          endpoint={this.getEndpoint()}
          query={{
            statsPeriod: this.props.statsPeriod,
            per_page: this.props.pageSize,
            status: 'unresolved',
          }}
          pagination={false}
          renderEmpty={this.renderEmpty}
          ref={this.issueListRef}
          {...this.props}
        />
      </div>
    );
  }
}
