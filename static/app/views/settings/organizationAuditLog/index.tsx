import {browserHistory, RouteComponentProps} from 'react-router';

import {t} from 'sentry/locale';
import {AuditLog, Organization} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import AuditLogList from './auditLogList';

type Props = RouteComponentProps<{orgId: string}, {}> &
  AsyncView['props'] & {
    organization: Organization;
  };

type State = AsyncView['state'] & {
  entryList: AuditLog[] | null;
  entryListPageLinks: string | null;
  eventTypes: string[];
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
      ['eventTypes', `/audit-log-api-names/`],
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
    const {entryList, eventTypes, entryListPageLinks, loading, reloading} = this.state;
    const currentEventType = this.props.location.query.event;
    return (
      <AuditLogList
        entries={entryList}
        pageLinks={entryListPageLinks}
        eventType={currentEventType}
        eventTypes={eventTypes}
        onEventSelect={this.handleEventSelect}
        isLoading={loading || reloading}
        {...this.props}
      />
    );
  }
}

export default withOrganization(OrganizationAuditLog);
