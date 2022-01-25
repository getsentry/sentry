import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {DateString, OrganizationSummary} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableData, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';

type ChildrenArgs = {
  errored: boolean;
  loading: boolean;
  reloading: boolean;
  tableData?: TableDataWithTitle[];
};

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
}: {
  api: Client;
  organization: OrganizationSummary;
  yAxis: string | string[];
  query: string;
  orderby?: string;
  projects: number[];
  period?: string | null;
  start: DateString;
  end: DateString;
  environments: string[];
  referrer?: string;
  children: (args: ChildrenArgs) => React.ReactElement;
}) => {
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
  const [results, setResults] = useState(undefined as ChildrenArgs['tableData']);
  const [reloading, setReloading] = useState(false);
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setErrored(false);
    if (results) {
      setReloading(true);
    }
    doDiscoverQuery<TableData>(api, `/organizations/${organization.slug}/events-geo/`, {
      ...eventView.generateQueryStringObject(),
      referrer,
    })
      .then(discoverQueryResults => {
        setResults([discoverQueryResults[0]] as TableDataWithTitle[]);
        setReloading(false);
      })
      .catch(() => {
        setErrored(true);
        setReloading(false);
      });
  }, [query, yAxis, start, end, period, environments, projects]);
  return children({
    errored,
    loading: !results && !errored,
    reloading,
    tableData: results,
  });
};

export default EventsGeoRequest;
