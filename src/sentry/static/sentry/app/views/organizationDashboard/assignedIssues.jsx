import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import IssueList from 'app/components/issueList';
import {t} from 'app/locale';

export default class AssignedIssues extends React.Component {
  static propTypes = {
    statsPeriod: PropTypes.string,
    pageSize: PropTypes.number,
  };

  getEndpoint = () => {
    return `/organizations/${this.props.params.orgId}/members/me/issues/assigned/?`;
  };

  getViewMoreLink = () => {
    return `/organizations/${this.props.params.orgId}/issues/assigned/`;
  };

  renderEmpty = () => {
    return (
      <Panel>
        <PanelBody>
          <PanelItem justify="center">
            {t('No issues have been assigned to you.')}
          </PanelItem>
        </PanelBody>
      </Panel>
    );
  };

  refresh = () => {
    this.refs.issueList.remountComponent();
  };

  render() {
    return (
      <div>
        <div className="pull-right">
          <Link className="btn btn-sm btn-default" to={this.getViewMoreLink()}>
            {t('View more')}
          </Link>
          <a
            className="btn btn-sm btn-default"
            style={{marginLeft: 5}}
            onClick={this.refresh}
          >
            <span className="icon icon-refresh" />
          </a>
        </div>
        <h4>Assigned to me</h4>
        <IssueList
          endpoint={this.getEndpoint()}
          query={{
            statsPeriod: this.props.statsPeriod,
            per_page: this.props.pageSize,
            status: 'unresolved',
          }}
          pagination={false}
          renderEmpty={this.renderEmpty}
          ref="issueList"
          {...this.props}
        />
      </div>
    );
  }
}
