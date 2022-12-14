import {useEffect, useMemo, useState} from 'react';

import {Client} from 'sentry/api';
import {DateString, OrganizationSummary} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableData, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import toArray from 'sentry/utils/toArray';
import usePrevious from 'sentry/utils/usePrevious';

interface ChildrenRenderProps {
  errored: boolean;
  loading: boolean;
  reloading: boolean;
  tableData?: TableDataWithTitle[];
}

export interface EventsGeoRequestProps {
  api: Client;
  children: (props: ChildrenRenderProps) => React.ReactElement;
  end: DateString;
  environments: string[];
  organization: OrganizationSummary;
  projects: number[];
  query: string;
  start: DateString;
  yAxis: string | string[];
  orderby?: string;
  period?: string | null;
  referrer?: string;
}

const EventsGeoRequest = ({
  api,
  organization,
  yAxis,
  query,
  orderby,
  projects,
  period,
  start,
  end,
  environments,
  referrer,
  children,
}: EventsGeoRequestProps) => {
  const eventView = useMemo(
    () =>
      EventView.fromSavedQuery({
        id: undefined,
        name: '',
        version: 2,
        fields: toArray(yAxis),
        query,
        orderby: orderby ?? '',
        projects,
        range: period ?? '',
        start: start ? getUtcDateString(start) : undefined,
        end: end ? getUtcDateString(end) : undefined,
        environment: environments,
      }),
    [yAxis, query, orderby, projects, period, start, end, environments]
  );
  const [results, setResults] = useState(undefined as ChildrenRenderProps['tableData']);
  const [reloading, setReloading] = useState(false);
  const [errored, setErrored] = useState(false);

  const prevApi = usePrevious(api);
  const prevEventView = usePrevious(eventView);
  const prevOrgSlug = usePrevious(organization.slug);
  const prevReferrer = usePrevious(referrer);

  useEffect(() => {
    let mounted = true;
    setErrored(false);

    if (
      prevApi !== api ||
      prevEventView !== eventView ||
      prevOrgSlug !== organization.slug ||
      prevReferrer !== referrer
    ) {
      setReloading(true);
    }

    doDiscoverQuery<TableData>(api, `/organizations/${organization.slug}/events-geo/`, {
      ...eventView.generateQueryStringObject(),
      referrer,
    })
      .then(discoverQueryResults => {
        if (mounted) {
          setResults([discoverQueryResults[0]] as TableDataWithTitle[]);
          setReloading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setErrored(true);
          setReloading(false);
        }
      });

    return () => {
      // Prevent setState leaking on unmounted component
      mounted = false;
    };
  }, [
    api,
    eventView,
    organization.slug,
    referrer,
    prevApi,
    prevEventView,
    prevOrgSlug,
    prevReferrer,
  ]);

  return children({
    errored,
    loading: !results && !errored,
    reloading,
    tableData: results,
  });
};

export default EventsGeoRequest;
