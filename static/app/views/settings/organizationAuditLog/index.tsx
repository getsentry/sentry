import {Fragment, useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {normalizeDateTimeString} from 'sentry/components/organizations/pageFilters/parse';
import type {CursorHandler} from 'sentry/components/pagination';
import type {ChangeData} from 'sentry/components/timeRangeSelector';
import type {DateString} from 'sentry/types/core';
import type {AuditLog} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getDateWithTimezoneInUtc, getUserTimezone} from 'sentry/utils/dates';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

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
  statsPeriod: string | null;
  utc: boolean;
  currentCursor?: string;
  end?: DateString;
  start?: DateString;
};

function OrganizationAuditLog({location}: Props) {
  const [state, setState] = useState<State>({
    entryList: [],
    entryListPageLinks: null,
    eventType: decodeScalar(location.query.event),
    eventTypes: [],
    isLoading: true,
    start: decodeScalar(location.query.start) as DateString | undefined,
    end: decodeScalar(location.query.end) as DateString | undefined,
    statsPeriod: decodeScalar(location.query.statsPeriod) ?? null,
    utc: decodeScalar(location.query.utc) === 'true' || getUserTimezone() === 'UTC',
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
    const start = decodeScalar(location.query.start) as DateString | undefined;
    const end = decodeScalar(location.query.end) as DateString | undefined;
    const statsPeriod = decodeScalar(location.query.statsPeriod) ?? null;
    const utc =
      decodeScalar(location.query.utc) === 'true' || getUserTimezone() === 'UTC';

    setState(prevState => ({
      ...prevState,
      eventType,
      start,
      end,
      statsPeriod: statsPeriod ?? prevState.statsPeriod,
      utc,
    }));
  }, [location.query]);

  const fetchAuditLogData = useCallback(async () => {
    if (!hasPermission) {
      return;
    }

    setState(prevState => ({...prevState, isLoading: true}));

    try {
      const payload = {
        cursor: state.currentCursor,
        event: state.eventType,
        start: state.start,
        end: state.end,
        statsPeriod: state.statsPeriod,
        utc: state.utc,
      };

      // Remove undefined values from payload
      Object.keys(payload).forEach(key => {
        if (
          payload[key as keyof typeof payload] === undefined ||
          payload[key as keyof typeof payload] === '' ||
          payload[key as keyof typeof payload] === null
        ) {
          delete payload[key as keyof typeof payload];
        }
      });

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
  }, [
    api,
    organization.slug,
    state.currentCursor,
    state.eventType,
    state.start,
    state.end,
    state.statsPeriod,
    state.utc,
    hasPermission,
  ]);

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

  const handleDateSelect = (data: ChangeData) => {
    let formattedStart: string | undefined;
    let formattedEnd: string | undefined;

    if (data.start && data.end) {
      // Convert to UTC because endpoint only takes in UTC timestamps
      const startUtc = getDateWithTimezoneInUtc(data.start, data.utc);
      const endUtc = getDateWithTimezoneInUtc(data.end, data.utc);
      formattedStart = normalizeDateTimeString(startUtc);
      formattedEnd = normalizeDateTimeString(endUtc);
    } else {
      // start and end must both be defined to pass to endpoint
      formattedStart = undefined;
      formattedEnd = undefined;
    }

    const formattedStatsPeriod = data.relative === 'allTime' ? null : data.relative;

    setState(prevState => ({
      ...prevState,
      start: formattedStart,
      end: formattedEnd,
      statsPeriod: formattedStatsPeriod,
      utc: data.utc ?? prevState.utc,
    }));

    // Always update URL when there are changes
    const newQuery: Record<string, string | undefined | null> = {
      ...location.query,
      start: formattedStart,
      end: formattedEnd,
      statsPeriod: formattedStatsPeriod,
    };

    // Only include UTC in query if it's been explicitly set
    if (data.utc !== undefined) {
      newQuery.utc = data.utc ? 'true' : 'false';
    }

    browserHistory.push({
      pathname: location.pathname,
      query: newQuery,
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
          onDateSelect={handleDateSelect}
          isLoading={state.isLoading}
          onCursor={handleCursor}
          start={state.start}
          end={state.end}
          statsPeriod={state.statsPeriod}
          utc={state.utc}
        />
      ) : (
        <OrganizationPermissionAlert />
      )}
    </Fragment>
  );
}

export default OrganizationAuditLog;
