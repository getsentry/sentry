import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {DateString, OrganizationSummary} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableData, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';

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
  const eventView = EventView.fromSavedQuery({
    id: undefined,
    name: '',
    version: 2,
    fields: Array.isArray(yAxis) ? yAxis : [yAxis],
    query,
    orderby: orderby ?? '',
    projects,
    range: period ?? '',
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
    environment: environments,
  });
  const [results, setResults] = useState(undefined as ChildrenRenderProps['tableData']);
  const [reloading, setReloading] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let mounted = true;
    setErrored(false);

    if (results) {
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
  }, [query, yAxis, start, end, period, environments, projects]);

  return children({
    errored,
    loading: !results && !errored,
    reloading,
    tableData: results,
  });
};

export default EventsGeoRequest;
