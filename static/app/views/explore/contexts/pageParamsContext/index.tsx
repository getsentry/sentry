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

import type {AggregateField, BaseAggregateField, GroupBy} from './aggregateFields';
import {
  defaultAggregateFields,
  getAggregateFieldsFromLocation,
  isGroupBy,
  isVisualize,
  updateLocationWithAggregateFields,
} from './aggregateFields';
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
  dataset: DiscoverDatasets | undefined;
  fields: string[];
  mode: Mode;
  query: string;
  sortBys: Sort[];
  id?: string;
  title?: string;
}

class ReadablePageParams {
  aggregateFields: AggregateField[];
  dataset: DiscoverDatasets | undefined;
  fields: string[];
  mode: Mode;
  query: string;
  sortBys: Sort[];
  id?: string;
  title?: string;
  private _groupBys: string[];
  private _visualizes: Visualize[];

  constructor(options: ReadablePageParamsOptions) {
    this.aggregateFields = options.aggregateFields;
    this.dataset = options.dataset;
    this.fields = options.fields;
    this.mode = options.mode;
    this.query = options.query;
    this.sortBys = options.sortBys;
    this.id = options.id;
    this.title = options.title;

    this._groupBys = this.aggregateFields
      .filter(isGroupBy)
      .map(groupBy => groupBy.groupBy);
    this._visualizes = this.aggregateFields.filter(isVisualize);
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
  dataset?: DiscoverDatasets | null;
  fields?: string[] | null;
  id?: string | null;
  mode?: Mode | null;
  query?: string | null;
  sortBys?: Sort[] | null;
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
  const sortBys = defaultSortBys(
    mode,
    fields,
    aggregateFields.filter(isVisualize).flatMap(visualize => visualize.yAxes)
  );

  return new ReadablePageParams({
    aggregateFields,
    dataset,
    fields,
    mode,
    query,
    sortBys,
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
    const sortBys = getSortBysFromLocation(location, mode, fields, groupBys, visualizes);
    const title = getTitleFromLocation(location);
    const id = getIdFromLocation(location);

    return new ReadablePageParams({
      aggregateFields,
      dataset,
      fields,
      mode,
      query,
      sortBys,
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
  return DiscoverDatasets.SPANS_EAP_RPC;
}

export function useExploreAggregateFields(): AggregateField[] {
  const pageParams = useExplorePageParams();
  return pageParams.aggregateFields;
}

export function useExploreFields(): string[] {
  const pageParams = useExplorePageParams();
  return pageParams.fields;
}

export function useExploreGroupBys(): string[] {
  const pageParams = useExplorePageParams();
  return pageParams.groupBys;
}

export function useExploreMode(): Mode {
  const pageParams = useExplorePageParams();
  return pageParams.mode;
}

export function useExploreQuery(): string {
  const pageParams = useExplorePageParams();
  return pageParams.query;
}

export function useExploreSortBys(): Sort[] {
  const pageParams = useExplorePageParams();
  return pageParams.sortBys;
}

export function useExploreTitle(): string | undefined {
  const pageParams = useExplorePageParams();
  return pageParams.title;
}

export function useExploreId(): string | undefined {
  const pageParams = useExplorePageParams();
  return pageParams.id;
}

export function useExploreVisualizes(): Visualize[] {
  const pageParams = useExplorePageParams();
  return pageParams.visualizes;
}

export function newExploreTarget(
  location: Location,
  pageParams: WritablePageParams
): Location {
  const target = {...location, query: {...location.query}};
  updateLocationWithAggregateFields(target, pageParams.aggregateFields);
  updateLocationWithDataset(target, pageParams.dataset);
  updateLocationWithFields(target, pageParams.fields);
  updateLocationWithMode(target, pageParams.mode);
  updateLocationWithQuery(target, pageParams.query);
  updateLocationWithSortBys(target, pageParams.sortBys);
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
    .flatMap(visualize => visualize.yAxes)
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
          ?.filter<Visualize>(isVisualize)
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

export function useSetExploreAggregateFields() {
  const setPageParams = useSetExplorePageParams();
  return useCallback(
    (aggregateFields: BaseAggregateField[]) => {
      setPageParams({aggregateFields});
    },
    [setPageParams]
  );
}

export function useSetExploreFields() {
  const setPageParams = useSetExplorePageParams();
  return useCallback(
    (fields: string[]) => {
      setPageParams({fields});
    },
    [setPageParams]
  );
}

export function useSetExploreGroupBys() {
  const pageParams = useExplorePageParams();
  const setPageParams = useSetExplorePageParams();
  return useCallback(
    (groupBys: string[], mode?: Mode) => {
      const aggregateFields = [];
      let i = 0;
      for (const aggregateField of pageParams.aggregateFields) {
        if (isGroupBy(aggregateField)) {
          if (i < groupBys.length) {
            const groupBy: GroupBy = {groupBy: groupBys[i++]!};
            aggregateFields.push(groupBy);
          }
        } else {
          aggregateFields.push(aggregateField.toJSON());
        }
      }
      for (; i < groupBys.length; i++) {
        const groupBy = {groupBy: groupBys[i]!};
        aggregateFields.push(groupBy);
      }

      setPageParams({aggregateFields, mode});
    },
    [pageParams, setPageParams]
  );
}

export function useSetExploreMode() {
  const pageParams = useExplorePageParams();
  const setPageParams = useSetExplorePageParams();

  return useCallback(
    (mode: Mode) => {
      if (mode === Mode.SAMPLES && pageParams.groupBys.some(groupBy => groupBy !== '')) {
        // When switching from the aggregates to samples mode, carry
        // over any group bys as they are helpful context when looking
        // for examples.
        const fields = [...pageParams.fields];
        for (const groupBy of pageParams.groupBys) {
          if (groupBy !== '' && !fields.includes(groupBy)) {
            fields.push(groupBy);
          }
        }

        setPageParams({
          mode,
          fields,
        });
      } else {
        setPageParams({mode});
      }
    },
    [pageParams, setPageParams]
  );
}

export function useSetExploreQuery() {
  const setPageParams = useSetExplorePageParams();
  return useCallback(
    (query: string) => {
      setPageParams({query});
    },
    [setPageParams]
  );
}

export function useSetExploreSortBys() {
  const setPageParams = useSetExplorePageParams();
  return useCallback(
    (sortBys: Sort[]) => {
      setPageParams({sortBys});
    },
    [setPageParams]
  );
}

export function useSetExploreVisualizes() {
  const pageParams = useExplorePageParams();
  const setPageParams = useSetExplorePageParams();
  return useCallback(
    (visualizes: BaseVisualize[]) => {
      const aggregateFields: WritablePageParams['aggregateFields'] = [];
      let i = 0;
      for (const aggregateField of pageParams.aggregateFields) {
        if (isVisualize(aggregateField)) {
          if (i < visualizes.length) {
            aggregateFields.push(visualizes[i++]!);
          }
        } else {
          aggregateFields.push(aggregateField);
        }
      }
      for (; i < visualizes.length; i++) {
        aggregateFields.push(visualizes[i]!);
      }

      setPageParams({aggregateFields});
    },
    [pageParams, setPageParams]
  );
}

export function useSetExploreTitle() {
  const setPageParams = useSetExplorePageParams();
  return useCallback(
    (title: string) => {
      setPageParams({title});
    },
    [setPageParams]
  );
}

export function useSetExploreId() {
  const setPageParams = useSetExplorePageParams();
  return useCallback(
    (id: string) => {
      setPageParams({id});
    },
    [setPageParams]
  );
}
