import {browserHistory, RouteComponentProps} from 'react-router';

import {t} from 'app/locale';
import {LightWeightOrganization} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';

import AuditLogList from './auditLogList';

// Please keep this list sorted
const EVENT_TYPES = [
  'member.invite',
  'member.add',
  'member.accept-invite',
  'member.remove',
  'member.edit',
  'member.join-team',
  'member.leave-team',
  'member.pending',
  'team.create',
  'team.edit',
  'team.remove',
  'project.create',
  'project.edit',
  'project.remove',
  'project.set-public',
  'project.set-private',
  'project.request-transfer',
  'project.accept-transfer',
  'org.create',
  'org.edit',
  'org.remove',
  'org.restore',
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
  'rule.create',
  'rule.edit',
  'rule.remove',
  'servicehook.create',
  'servicehook.edit',
  'servicehook.remove',
  'servicehook.enable',
  'servicehook.disable',
  'integration.add',
  'integration.edit',
  'integration.remove',
  'ondemand.edit',
  'trial.started',
  'plan.changed',
  'plan.cancelled',
];

type Props = RouteComponentProps<{orgId: string}, {}> &
  AsyncView['props'] & {
    organization: LightWeightOrganization;
  };

type State = AsyncView['state'];

class OrganizationAuditLog extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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
    return routeTitleGen(t('Audit Log'), this.props.organization.slug, false);
  }

  handleEventSelect = (value: string) => {
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
    const currentEventType = this.props.location.query.event;
    return (
      <AuditLogList
        entries={this.state.entryList}
        pageLinks={this.state.entryListPageLinks}
        eventType={currentEventType}
        eventTypes={EVENT_TYPES}
        onEventSelect={this.handleEventSelect}
        {...this.props}
      />
    );
  }
}

export default withOrganization(OrganizationAuditLog);
