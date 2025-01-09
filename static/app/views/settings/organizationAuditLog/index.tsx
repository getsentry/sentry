import {Fragment, useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {CursorHandler} from 'sentry/components/pagination';
import type {AuditLog} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import AuditLogList from './auditLogList';

type Props = {
  location: Location;
};

type State = {
  entryList: AuditLog[] | null;
  entryListPageLinks: string | null;
  eventType: string | undefined;
  eventTypes: string[] | null;
  isLoading: boolean;
  currentCursor?: string;
};

function OrganizationAuditLog({location}: Props) {
  const [state, setState] = useState<State>({
    entryList: [],
    entryListPageLinks: null,
    eventType: decodeScalar(location.query.event),
    eventTypes: [],
    isLoading: true,
  });
  const organization = useOrganization();
  const api = useApi();

  const hasPermission = organization.access.includes('org:write') || isActiveSuperuser();

  const handleCursor: CursorHandler = resultsCursor => {
    setState(prevState => ({
      ...prevState,
      currentCursor: resultsCursor,
    }));
  };

  useEffect(() => {
    // Watch the location for changes so we can re-fetch data.
    const eventType = decodeScalar(location.query.event);
    setState(prevState => ({...prevState, eventType}));
  }, [location.query]);

  const fetchAuditLogData = useCallback(async () => {
    if (!hasPermission) {
      return;
    }

    setState(prevState => ({...prevState, isLoading: true}));

    try {
      const payload = {cursor: state.currentCursor, event: state.eventType};
      if (!payload.cursor) {
        delete payload.cursor;
      }
      if (!payload.event) {
        delete payload.event;
      }
      setState(prevState => ({...prevState, isLoading: true}));
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
        eventTypes: data.options,
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
      if (err.status !== 403) {
        addErrorMessage('Unable to load audit logs.');
      }
    }
  }, [api, organization.slug, state.currentCursor, state.eventType, hasPermission]);

  useEffect(() => {
    fetchAuditLogData();
  }, [fetchAuditLogData]);

  const handleEventSelect = (value: string) => {
    setState(prevState => ({
      ...prevState,
      eventType: value,
    }));
    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, event: value},
    });
  };

  return (
    <Fragment>
      {hasPermission ? (
        <AuditLogList
          entries={state.entryList}
          pageLinks={state.entryListPageLinks}
          eventType={state.eventType}
          eventTypes={state.eventTypes}
          onEventSelect={handleEventSelect}
          isLoading={state.isLoading}
          onCursor={handleCursor}
        />
      ) : (
        <PermissionAlert />
      )}
    </Fragment>
  );
}

export default OrganizationAuditLog;
