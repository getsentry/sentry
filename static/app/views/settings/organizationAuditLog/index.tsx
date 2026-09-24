import {Fragment, useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {CursorHandler} from '@sentry/scraps/pagination';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {normalizeDateTimeString} from 'sentry/components/pageFilters/parse';
import type {ChangeData} from 'sentry/components/timeRangeSelector';
import type {AuditLog} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getDateWithTimezoneInUtc, getUserTimezone} from 'sentry/utils/dates';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

import {AuditLogList} from './auditLogList';

type AuditLogResponse = {
  options: string[];
  rows: AuditLog[];
};

function OrganizationAuditLog() {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();

  const hasPermission = organization.access.includes('org:write') || isActiveSuperuser();

  const cursor = decodeScalar(location.query.cursor);
  const eventType = decodeScalar(location.query.event);
  const start = decodeScalar(location.query.start);
  const end = decodeScalar(location.query.end);
  const statsPeriod = decodeScalar(location.query.statsPeriod);
  const utc = decodeScalar(location.query.utc) === 'true' || getUserTimezone() === 'UTC';

  const {data, isPending, isError} = useQuery({
    ...apiOptions.as<AuditLogResponse>()(
      '/organizations/$organizationIdOrSlug/audit-logs/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {cursor, event: eventType, start, end, statsPeriod, utc},
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
    enabled: hasPermission,
  });

  useEffect(() => {
    if (isError) {
      addErrorMessage('Unable to load audit logs.');
    }
  }, [isError]);

  const handleCursor: CursorHandler = resultsCursor => {
    navigate({
      query: {...location.query, cursor: resultsCursor},
    });
  };

  const handleEventSelect = (value: string) => {
    navigate({
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

    navigate({
      query: newQuery,
    });
  };

  return (
    <Fragment>
      {hasPermission ? (
        <AuditLogList
          entries={data?.json.rows ?? null}
          pageLinks={data?.headers.Link ?? null}
          eventType={eventType}
          eventTypes={data?.json.options ?? null}
          onEventSelect={handleEventSelect}
          onDateSelect={handleDateSelect}
          isLoading={isPending}
          onCursor={handleCursor}
          start={start}
          end={end}
          statsPeriod={statsPeriod ?? null}
          utc={utc}
        />
      ) : (
        <OrganizationPermissionAlert />
      )}
    </Fragment>
  );
}

export default OrganizationAuditLog;
