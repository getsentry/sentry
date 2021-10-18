import {useEffect, useState} from 'react';

import {Client} from 'app/api';
import {DateString, OrganizationSummary} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import {TableData, TableDataWithTitle} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {doDiscoverQuery} from 'app/utils/discover/genericDiscoverQuery';

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
  period?: string;
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
  useEffect(() => {
    if (results) {
      setReloading(true);
    }
    doDiscoverQuery<TableData>(api, `/organizations/${organization.slug}/events-geo/`, {
      ...eventView.generateQueryStringObject(),
      referrer,
    }).then(discoverQueryResults => {
      setResults([discoverQueryResults[0]] as TableDataWithTitle[]);
      setReloading(false);
    });
  }, [query, yAxis, start, end, period, environments, projects]);
  return children({
    errored: false,
    loading: !results,
    reloading,
    tableData: results,
  });
};

export default EventsGeoRequest;
