import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import LazyLoad from '../../../../components/lazyLoad';
import AsyncView from '../../../asyncView';
import SentryTypes from '../../../../proptypes';

const EVENT_TYPES = [
  'member.invite',
  'member.add',
  'member.accept-invite',
  'member.remove',
  'member.edit',
  'member.join-team',
  'member.leave-team',
  'team.create',
  'team.edit',
  'team.remove',
  'project.create',
  'project.edit',
  'project.remove',
  'project.set-public',
  'project.set-private',
  'org.create',
  'org.edit',
  'org.remove',
  'tagkey.remove',
  'projectkey.create',
  'projectkey.edit',
  'projectkey.remove',
  'projectkey.enable',
  'projectkey.disable',
  'sso.enable',
  'sso.disable',
  'sso.edit',
  'sso-identity.link',
  'api-key.create',
  'api-key.edit',
  'api-key.remove',
].sort();

class AuditLogView extends AsyncView {
  static propTypes = {
    routes: PropTypes.array,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  getEndpoints() {
    return [
      [
        'entryList',
        `/organizations/${this.props.params.orgId}/audit-logs/`,
        {
          query: this.props.location.query,
        },
      ],
    ];
  }

  getTitle() {
    let org = this.context.organization;
    return `${org.name} Audit Log`;
  }

  handleEventSelect = value => {
    // Dont update if event has not changed
    if (this.props.location.query.event === value) {
      return;
    }

    browserHistory.push({
      pathname: this.props.location.pathname,
      search: `?event=${value}`,
    });
  };

  renderBody() {
    let currentEventType = this.props.location.query.event;

    return (
      <LazyLoad
        component={() =>
          import(/*webpackChunkName: "auditLogList"*/ './auditLogList').then(
            mod => mod.default
          )}
        entries={this.state.entryList}
        pageLinks={this.state.pageLinks}
        eventType={currentEventType}
        eventTypes={EVENT_TYPES}
        onEventSelect={this.handleEventSelect}
        {...this.props}
      />
    );
  }
}

export default AuditLogView;
