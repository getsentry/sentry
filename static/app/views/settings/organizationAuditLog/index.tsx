import {Fragment, useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {parseAsBoolean, parseAsString, useQueryStates} from 'nuqs';

import type {CursorHandler} from '@sentry/scraps/pagination';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {normalizeDateTimeString} from 'sentry/components/pageFilters/parse';
import type {ChangeData} from 'sentry/components/timeRangeSelector';
import type {AuditLog} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getDateWithTimezoneInUtc, getUserTimezone} from 'sentry/utils/dates';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

import {AuditLogList} from './auditLogList';

type AuditLogResponse = {
  options: string[];
  rows: AuditLog[];
};

function OrganizationAuditLog() {
  const organization = useOrganization();

  const hasPermission = organization.access.includes('org:write') || isActiveSuperuser();

  const [queryParams, setQueryParams] = useQueryStates(
    {
      cursor: parseAsString,
      event: parseAsString,
      start: parseAsString,
      end: parseAsString,
      statsPeriod: parseAsString,
      utc: parseAsBoolean,
    },
    // Each filter or page change is a step the back button should undo
    {history: 'push'}
  );
  const cursor = queryParams.cursor ?? undefined;
  const eventType = queryParams.event ?? undefined;
  const start = queryParams.start ?? undefined;
  const end = queryParams.end ?? undefined;
  const statsPeriod = queryParams.statsPeriod ?? undefined;
  const utc = queryParams.utc === true || getUserTimezone() === 'UTC';

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
    setQueryParams({cursor: resultsCursor ?? null});
  };

  const handleEventSelect = (value: string) => {
    setQueryParams({event: value, cursor: null});
  };

  const handleDateSelect = (changeData: ChangeData) => {
    let formattedStart: string | null = null;
    let formattedEnd: string | null = null;

    if (changeData.start && changeData.end) {
      // Convert to UTC because endpoint only takes in UTC timestamps
      const startUtc = getDateWithTimezoneInUtc(changeData.start, changeData.utc);
      const endUtc = getDateWithTimezoneInUtc(changeData.end, changeData.utc);
      formattedStart = normalizeDateTimeString(startUtc) ?? null;
      formattedEnd = normalizeDateTimeString(endUtc) ?? null;
    }

    const formattedStatsPeriod =
      changeData.relative === 'allTime' ? null : changeData.relative;

    // Reset cursor to avoid stale pagination. Only include UTC if it's been
    // explicitly set; nuqs would write an undefined value as the string "undefined".
    setQueryParams({
      start: formattedStart,
      end: formattedEnd,
      statsPeriod: formattedStatsPeriod ?? null,
      cursor: null,
      ...(changeData.utc === undefined ? {} : {utc: Boolean(changeData.utc)}),
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
