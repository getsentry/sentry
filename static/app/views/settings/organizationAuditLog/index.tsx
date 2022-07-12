import {Fragment, useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {CursorHandler} from 'sentry/components/pagination';
import {AuditLog, Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

import AuditLogList from './auditLogList';

type Props = {
  organization: Organization;
};

type State = {
  entryList: AuditLog[] | null;
  entryListPageLinks: string | null;
  eventTypes: string[] | null;
  isLoading: boolean;
  currentCursor?: string;
  eventType?: string;
};

function OrganizationAuditLog({organization}: Props) {
  const [state, setState] = useState<State>({
    entryList: [],
    entryListPageLinks: null,
    eventTypes: [],
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
      const payload = {cursor: state.currentCursor, event: state.eventType, version: '2'};
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
        entryList: data.rows,
        eventTypes: data.options.sort(),
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
        eventTypes={state.eventTypes}
        onEventSelect={handleEventSelect}
        isLoading={state.isLoading}
        onCursor={handleCursor}
      />
    </Fragment>
  );
}

export default withOrganization(OrganizationAuditLog);
