import {Fragment, useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {CursorHandler} from 'sentry/components/pagination';
import {AuditLog, Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

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

type Props = {
  organization: Organization;
};

type State = {
  entryList: AuditLog[] | null;
  entryListPageLinks: string | null;
  isLoading: boolean;
  currentCursor?: string;
  eventType?: string;
};

function OrganizationAuditLog({organization}: Props) {
  const [state, setState] = useState<State>({
    entryList: [],
    entryListPageLinks: null,
    isLoading: true,
  });

  const api = useApi();

  const handleCursor: CursorHandler = resultsCursor => {
    setState(prevState => ({
      ...prevState,
      currentCursor: resultsCursor,
    }));
  };

  const fetchAuditLogData = useCallback(async () => {
    try {
      const payload = {cursor: state.currentCursor, event: state.eventType};
      if (!payload.cursor) {
        delete payload.cursor;
      }
      if (!payload.event) {
        delete payload.event;
      }
      const [data, _, response] = await api.requestPromise(
        `/organizations/${organization.slug}/audit-logs/`,
        {
          method: 'GET',
          includeAllArgs: true,
          query: payload,
        }
      );
      setState(prevState => ({
        ...prevState,
        entryList: data,
        isLoading: false,
        entryListPageLinks: response?.getResponseHeader('Link') ?? null,
      }));
    } catch (err) {
      if (err.status !== 401 && err.status !== 403) {
        Sentry.captureException(err);
      }
      setState(prevState => ({
        ...prevState,
        isLoading: false,
      }));
      addErrorMessage('Unable to load audit logs.');
    }
  }, [api, organization.slug, state.currentCursor, state.eventType]);

  useEffect(() => {
    fetchAuditLogData();
  }, [fetchAuditLogData]);

  const handleEventSelect = (value: string | undefined) => {
    setState(prevState => ({
      ...prevState,
      eventType: value,
    }));
  };

  return (
    <Fragment>
      <AuditLogList
        entries={state.entryList}
        pageLinks={state.entryListPageLinks}
        eventType={state.eventType}
        eventTypes={EVENT_TYPES}
        onEventSelect={handleEventSelect}
        isLoading={state.isLoading}
        onCursor={handleCursor}
      />
    </Fragment>
  );
}

export default withOrganization(OrganizationAuditLog);
