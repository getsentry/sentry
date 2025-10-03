import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {Location} from 'history';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  defaultId,
  getIdFromLocation,
  updateLocationWithId,
} from 'sentry/views/explore/contexts/pageParamsContext/id';

import type {AggregateField, GroupBy} from './aggregateFields';
import {
  defaultAggregateFields,
  getAggregateFieldsFromLocation,
  isBaseVisualize,
  isGroupBy,
  isVisualize,
  updateLocationWithAggregateFields,
} from './aggregateFields';
import {
  defaultAggregateSortBys,
  getAggregateSortBysFromLocation,
  updateLocationWithAggregateSortBys,
} from './aggregateSortBys';
import {
  defaultDataset,
  getDatasetFromLocation,
  updateLocationWithDataset,
} from './dataset';
import {
  defaultFields,
  getFieldsFromLocation,
  isDefaultFields,
  updateLocationWithFields,
} from './fields';
import {defaultMode, getModeFromLocation, Mode, updateLocationWithMode} from './mode';
import {defaultQuery, getQueryFromLocation, updateLocationWithQuery} from './query';
import {
  defaultSortBys,
  getSortBysFromLocation,
  updateLocationWithSortBys,
} from './sortBys';
import {defaultTitle, getTitleFromLocation, updateLocationWithTitle} from './title';
import type {BaseVisualize, Visualize} from './visualizes';

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

interface WritablePageParams {
  aggregateFields?: Array<GroupBy | BaseVisualize> | null;
  aggregateSortBys?: Sort[] | null;
  dataset?: DiscoverDatasets | null;
  fields?: string[] | null;
  id?: string | null;
  mode?: Mode | null;
  query?: string | null;
  sampleSortBys?: Sort[] | null;
  title?: string | null;
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

function useExploreAutoFields(): Set<string> {
  const contextValue = useContext(PageParamsContext);
  return contextValue.managedFields;
}

function useSetExploreAutoFields(): (managedFields: Set<string>) => void {
  const contextValue = useContext(PageParamsContext);
  return contextValue.setManagedFields;
}

export function useExplorePageParams(): ReadablePageParams {
  const contextValue = useContext(PageParamsContext);
  return contextValue.pageParams;
}

export function useExploreDataset(): DiscoverDatasets {
  return DiscoverDatasets.SPANS;
}

export function useExploreSortBys(): Sort[] {
  const pageParams = useExplorePageParams();
  return pageParams.mode === Mode.AGGREGATE
    ? pageParams.aggregateSortBys
    : pageParams.sortBys;
}

export function useExploreAggregateSortBys(): Sort[] {
  const pageParams = useExplorePageParams();
  return pageParams.aggregateSortBys;
}

export function useExploreTitle(): string | undefined {
  const pageParams = useExplorePageParams();
  return pageParams.title;
}

export function useExploreId(): string | undefined {
  const pageParams = useExplorePageParams();
  return pageParams.id;
}

export function newExploreTarget(
  location: Location,
  pageParams: WritablePageParams
): Location {
  const target = {...location, query: {...location.query}};
  updateLocationWithAggregateFields(target, pageParams.aggregateFields);
  updateLocationWithAggregateSortBys(target, pageParams.aggregateSortBys);
  updateLocationWithDataset(target, pageParams.dataset);
  updateLocationWithFields(target, pageParams.fields);
  updateLocationWithMode(target, pageParams.mode);
  updateLocationWithQuery(target, pageParams.query);
  updateLocationWithSortBys(target, pageParams.sampleSortBys);
  updateLocationWithTitle(target, pageParams.title);
  updateLocationWithId(target, pageParams.id);
  return target;
}

function findAllFields(
  readablePageParams: ReadablePageParams,
  writablePageParams: WritablePageParams
): {
  addedFields: Set<string>;
  removedFields: Set<string>;
} {
  if (!defined(writablePageParams.fields)) {
    return {
      addedFields: new Set<string>(),
      removedFields: new Set<string>(),
    };
  }

  const curFields: Map<string, number> = readablePageParams.fields.reduce(
    (fields, field) => {
      const count = fields.get(field) || 0;
      fields.set(field, count + 1);
      return fields;
    },
    new Map<string, number>()
  );
  const newFields: Map<string, number> = writablePageParams.fields.reduce(
    (fields, field) => {
      const count = fields.get(field) || 0;
      fields.set(field, count + 1);
      return fields;
    },
    new Map<string, number>()
  );

  const addedFields = new Set<string>();
  const removedFields = new Set<string>();

  function checkField(_count: number, field: string) {
    const curCount = curFields.get(field) || 0;
    const newCount = newFields.get(field) || 0;
    if (curCount > newCount) {
      removedFields.add(field);
    } else if (curCount < newCount) {
      addedFields.add(field);
    }
  }

  curFields.forEach(checkField);
  newFields.forEach(checkField);

  return {addedFields, removedFields};
}

/**
 * Get a count of all the fields that are referenced else where in the query.
 * This is useful to compute the changes (added/removed references) that will
 * be used to determine if a field should be managed and added to the table.
 */
function findAllFieldRefs(
  readablePageParams: ReadablePageParams,
  writablePageParams: WritablePageParams
): {
  curRefs: Map<string, number>;
  newRefs: Map<string, number>;
} {
  const curRefs: Map<string, number> = new Map();
  const newRefs: Map<string, number> = new Map();

  const readableVisualizeFields = readablePageParams.aggregateFields
    .filter<Visualize>(isVisualize)
    .map(visualize => visualize.yAxis)
    .map(yAxis => parseFunction(yAxis)?.arguments?.[0])
    .filter<string>(defined);

  readableVisualizeFields.forEach(field => {
    const count = curRefs.get(field) || 0;
    curRefs.set(field, count + 1);
  });

  const writableVisualizeFields =
    // null means to clear it so make sure to handle it correctly
    writablePageParams.aggregateFields === null
      ? []
      : writablePageParams.aggregateFields
          ?.filter<BaseVisualize>(isBaseVisualize)
          ?.flatMap(visualize => visualize.yAxes)
          ?.map(yAxis => parseFunction(yAxis)?.arguments?.[0])
          ?.filter<string>(defined);

  // if visualize fields aren't set on the writable page params, it means
  // it didn't change, so we fall back to using the fields from the readable
  // page params
  (writableVisualizeFields ?? readableVisualizeFields).forEach(field => {
    const count = newRefs.get(field) || 0;
    newRefs.set(field, count + 1);
  });

  return {curRefs, newRefs};
}

function deriveUpdatedAutoFields(
  managedFields: Set<string>,
  readablePageParams: ReadablePageParams,
  writablePageParams: WritablePageParams
): {
  updatedFields?: string[];
  updatedManagedFields?: Set<string>;
} {
  // null means to clear it, when this happens we should stop managing all fields
  if (writablePageParams.fields === null) {
    return {
      updatedManagedFields: new Set(),
    };
  }

  const {curRefs, newRefs} = findAllFieldRefs(readablePageParams, writablePageParams);

  const allFields = new Set<string>([...curRefs.keys(), ...newRefs.keys()]);

  // if the writable fields is undefined, it means we're not changing it
  // so we should infer it from the readable fields
  const fields = writablePageParams.fields ?? readablePageParams.fields;

  const fieldsToAdd = new Set<string>();
  const fieldsToDelete = new Set<string>();
  const updatedManagedFields = new Set(managedFields);

  allFields.forEach(field => {
    const curCount = curRefs.get(field) || 0;
    const newCount = newRefs.get(field) || 0;

    if (
      newCount > curCount &&
      !updatedManagedFields.has(field) &&
      !fields.includes(field)
    ) {
      // found a field that
      // 1. isn't in the list of fields
      // 2. isn't being managed
      // 3. a new reference was found
      // this means we should start managing the field
      updatedManagedFields.add(field);
      fieldsToAdd.add(field);
    } else if (curCount > 0 && newCount <= 0 && updatedManagedFields.has(field)) {
      // found a field that
      // 1. is being managed
      // 2. all references have been removed
      updatedManagedFields.delete(field);
      fieldsToDelete.add(field);
    }
  });

  const {removedFields} = findAllFields(readablePageParams, writablePageParams);

  // when a field is intentionally removed, it should no longer be managed
  removedFields.forEach(field => {
    updatedManagedFields.delete(field);
    fieldsToDelete.delete(field);
  });

  let updatedFields: string[] | undefined = undefined;

  if (fieldsToAdd.size || fieldsToDelete.size) {
    updatedFields = fields.filter(field => {
      const keep = !fieldsToDelete.has(field);
      if (!keep) {
        // it's possible the user manually added a duplicate of the field,
        // but we want to only delete 1 instance of the field
        fieldsToDelete.delete(field);
      }
      return keep;
    });
    updatedFields.push(...fieldsToAdd);
  }

  return {
    updatedFields,
    updatedManagedFields,
  };
}

export function useSetExplorePageParams(): (
  writablePageParams: WritablePageParams
) => void {
  const location = useLocation();
  const navigate = useNavigate();
  const managedFields = useExploreAutoFields();
  const setManagedFields = useSetExploreAutoFields();
  const readablePageParams = useExplorePageParams();

  return useCallback(
    (writablePageParams: WritablePageParams) => {
      const {updatedFields, updatedManagedFields} = deriveUpdatedAutoFields(
        managedFields,
        readablePageParams,
        writablePageParams
      );

      if (defined(updatedManagedFields)) {
        setManagedFields(updatedManagedFields);
      }

      if (defined(updatedFields)) {
        writablePageParams.fields = updatedFields;
      }

      const target = newExploreTarget(location, writablePageParams);
      navigate(target);
    },
    [location, navigate, readablePageParams, managedFields, setManagedFields]
  );
}

export function useSetExploreSortBys() {
  const pageParams = useExplorePageParams();
  const setPageParams = useSetExplorePageParams();
  return useCallback(
    (sortBys: Sort[]) => {
      setPageParams(
        pageParams.mode === Mode.AGGREGATE
          ? {aggregateSortBys: sortBys}
          : {sampleSortBys: sortBys}
      );
    },
    [pageParams, setPageParams]
  );
}
