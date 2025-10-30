import type React from 'react';
import {createContext, useEffect, useMemo, useState} from 'react';

import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  defaultId,
  getIdFromLocation,
} from 'sentry/views/explore/contexts/pageParamsContext/id';

import type {AggregateField} from './aggregateFields';
import {
  defaultAggregateFields,
  getAggregateFieldsFromLocation,
  isGroupBy,
  isVisualize,
} from './aggregateFields';
import {
  defaultAggregateSortBys,
  getAggregateSortBysFromLocation,
} from './aggregateSortBys';
import {defaultDataset, getDatasetFromLocation} from './dataset';
import {defaultFields, getFieldsFromLocation, isDefaultFields} from './fields';
import {defaultMode, getModeFromLocation, Mode} from './mode';
import {defaultQuery, getQueryFromLocation} from './query';
import {defaultSortBys, getSortBysFromLocation} from './sortBys';
import {defaultTitle, getTitleFromLocation} from './title';
import type {Visualize} from './visualizes';

interface ReadablePageParamsOptions {
  aggregateFields: AggregateField[];
  aggregateSortBys: Sort[];
  dataset: DiscoverDatasets | undefined;
  fields: string[];
  mode: Mode;
  query: string;
  sampleSortBys: Sort[];
  id?: string;
  title?: string;
}

class ReadablePageParams {
  aggregateFields: AggregateField[];
  aggregateSortBys: Sort[];
  dataset: DiscoverDatasets | undefined;
  fields: string[];
  mode: Mode;
  query: string;
  sampleSortBys: Sort[];
  id?: string;
  title?: string;
  private _groupBys: string[];
  private _visualizes: Visualize[];

  constructor(options: ReadablePageParamsOptions) {
    this.aggregateFields = options.aggregateFields;
    this.aggregateSortBys = options.aggregateSortBys;
    this.dataset = options.dataset;
    this.fields = options.fields;
    this.mode = options.mode;
    this.query = options.query;
    this.sampleSortBys = options.sampleSortBys;
    this.id = options.id;
    this.title = options.title;

    this._groupBys = this.aggregateFields
      .filter(isGroupBy)
      .map(groupBy => groupBy.groupBy);
    this._visualizes = this.aggregateFields.filter(isVisualize);
  }

  get sortBys(): Sort[] {
    return this.mode === Mode.AGGREGATE ? this.aggregateSortBys : this.sampleSortBys;
  }

  get groupBys(): string[] {
    return this._groupBys;
  }

  get visualizes(): Visualize[] {
    return this._visualizes;
  }
}

function defaultPageParams(): ReadablePageParams {
  const aggregateFields = defaultAggregateFields();
  const dataset = defaultDataset();
  const fields = defaultFields();
  const mode = defaultMode();
  const query = defaultQuery();
  const title = defaultTitle();
  const id = defaultId();
  const sortBys = defaultSortBys(fields);
  const aggregateSortBys = defaultAggregateSortBys(
    aggregateFields.filter(isVisualize).map(visualize => visualize.yAxis)
  );

  return new ReadablePageParams({
    aggregateFields,
    aggregateSortBys,
    dataset,
    fields,
    mode,
    query,
    sampleSortBys: sortBys,
    title,
    id,
  });
}

type PageParamsContextValue = {
  managedFields: Set<string>;
  pageParams: ReadablePageParams;
  setManagedFields: (managedFields: Set<string>) => void;
};

function defaultPageParamsContextValue() {
  return {
    managedFields: new Set<string>(),
    pageParams: defaultPageParams(),
    setManagedFields: () => {},
  };
}

const PageParamsContext = createContext<PageParamsContextValue>(
  defaultPageParamsContextValue()
);

interface PageParamsProviderProps {
  children: React.ReactNode;
}

export function PageParamsProvider({children}: PageParamsProviderProps) {
  const location = useLocation();
  const organization = useOrganization();

  const [managedFields, setManagedFields] = useState(new Set<string>());

  // Whenever the fields is reset to the defaults, we should wipe the state of the
  // managed fields. This can happen when
  // 1. user clicks on the side bar when already on the page
  // 2. some code intentionally wipes the fields
  const isUsingDefaultFields = isDefaultFields(location);
  useEffect(() => {
    if (isUsingDefaultFields) {
      setManagedFields(new Set());
    }
  }, [isUsingDefaultFields]);

  const pageParams: ReadablePageParams = useMemo(() => {
    const aggregateFields = getAggregateFieldsFromLocation(location, organization);
    const dataset = getDatasetFromLocation(location);
    const fields = getFieldsFromLocation(location, organization);
    const mode = getModeFromLocation(location);
    const query = getQueryFromLocation(location);
    const groupBys = aggregateFields.filter(isGroupBy).map(groupBy => groupBy.groupBy);
    const visualizes = aggregateFields.filter(isVisualize);
    const sortBys = getSortBysFromLocation(location, fields);
    const aggregateSortBys = getAggregateSortBysFromLocation(
      location,
      groupBys,
      visualizes
    );
    const title = getTitleFromLocation(location);
    const id = getIdFromLocation(location);

    return new ReadablePageParams({
      aggregateFields,
      aggregateSortBys,
      dataset,
      fields,
      mode,
      query,
      sampleSortBys: sortBys,
      title,
      id,
    });
  }, [location, organization]);

  const pageParamsContextValue: PageParamsContextValue = useMemo(() => {
    return {
      pageParams,
      managedFields,
      setManagedFields,
    };
  }, [pageParams, managedFields, setManagedFields]);

  return <PageParamsContext value={pageParamsContextValue}>{children}</PageParamsContext>;
}
