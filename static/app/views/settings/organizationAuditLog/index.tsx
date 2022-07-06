import {browserHistory, RouteComponentProps} from 'react-router';

import {t} from 'sentry/locale';
import {AuditLog, Organization} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

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
  'alertrule.create',
  'alertrule.edit',
  'alertrule.remove',
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
  'sentry-app.add',
  'sentry-app.remove',
  'sentry-app.install',
  'sentry-app.uninstall',
];

type Props = RouteComponentProps<{orgId: string}, {}> &
  AsyncView['props'] & {
    organization: Organization;
  };

type State = AsyncView['state'] & {
  entryList: AuditLog[] | null;
  entryListPageLinks: string | null;
};

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

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {entryList, entryListPageLinks, loading, reloading} = this.state;
    const currentEventType = this.props.location.query.event;
    return (
      <AuditLogList
        entries={entryList}
        pageLinks={entryListPageLinks}
        eventType={currentEventType}
        eventTypes={EVENT_TYPES}
        onEventSelect={this.handleEventSelect}
        isLoading={loading || reloading}
        {...this.props}
      />
    );
  }
}

export default withOrganization(OrganizationAuditLog);
