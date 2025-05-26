import type React from 'react';
import {createContext, useCallback, useContext, useMemo} from 'react';
import type {Location} from 'history';

import type {Sort} from 'sentry/utils/discover/fields';
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
import {defaultFields, getFieldsFromLocation, updateLocationWithFields} from './fields';
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

const PageParamsContext = createContext<ReadablePageParams>(defaultPageParams());

interface PageParamsProviderProps {
  children: React.ReactNode;
}

export function PageParamsProvider({children}: PageParamsProviderProps) {
  const location = useLocation();
  const organization = useOrganization();

  const pageParams: ReadablePageParams = useMemo(() => {
    const aggregateFields = getAggregateFieldsFromLocation(location, organization);
    const dataset = getDatasetFromLocation(location);
    const fields = getFieldsFromLocation(location);
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

  return <PageParamsContext value={pageParams}>{children}</PageParamsContext>;
}

export function useExplorePageParams(): ReadablePageParams {
  return useContext(PageParamsContext);
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

export function useSetExplorePageParams(): (pageParams: WritablePageParams) => void {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (pageParams: WritablePageParams) => {
      const target = newExploreTarget(location, pageParams);
      navigate(target);
    },
    [location, navigate]
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

      if (mode) {
        setPageParams({aggregateFields, mode});
      } else {
        setPageParams({aggregateFields});
      }
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
    (visualizes: BaseVisualize[], fields?: string[]) => {
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

      const writablePageParams: WritablePageParams = {aggregateFields};

      const newFields = fields?.filter(field => !pageParams.fields.includes(field)) || [];
      if (newFields.length > 0) {
        writablePageParams.fields = [...pageParams.fields, ...newFields];
      }

      setPageParams(writablePageParams);
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
