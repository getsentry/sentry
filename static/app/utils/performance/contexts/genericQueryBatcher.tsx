import type {Ref} from 'react';
import {createContext, Fragment, useEffect, useRef} from 'react';
import identity from 'lodash/identity';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {createDefinedContext} from './utils';

type QueryObject = {
  includeAllArgs: boolean | undefined;
  query: {
    [k: string]: any;
  };
}; // TODO(k-fish): Fix to ensure exact types for all requests. Simplified type for now, need to pull this in from events file.

export type Transform = (data: any, queryDefinition: BatchQueryDefinition) => any;

type BatchQueryDefinition = {
  api: Client;
  batchProperty: string;

  path: string;
  reject: (reason?: string) => void;
  requestQueryObject: QueryObject;
  // Intermediate promise functions
  resolve: (value: any) => void;
  transform?: Transform;
};

type QueryBatch = {
  addQuery: (q: BatchQueryDefinition, id: symbol) => void;
};

const [GenericQueryBatcherProvider, _useGenericQueryBatcher] =
  createDefinedContext<QueryBatch>({
    name: 'GenericQueryBatcherContext',
  });

function mergeKey(query: BatchQueryDefinition) {
  return `${query.batchProperty}.${query.path}`;
}

type MergeMap = Record<string, BatchQueryDefinition[]>;

// Builds a map that will contain an array of query definitions by mergeable key (using batch property and path)
function queriesToMap(collectedQueries: Record<symbol, BatchQueryDefinition>) {
  const keys = Reflect.ownKeys(collectedQueries);
  if (!keys.length) {
    return false;
  }
  const mergeMap: MergeMap = {};

  keys.forEach(key => {
    const query = collectedQueries[key];
    mergeMap[mergeKey(query)] = mergeMap[mergeKey(query)] || [];
    mergeMap[mergeKey(query)]!.push(query);
    delete collectedQueries[key];
  });

  return mergeMap;
}

function requestFunction(api: Client, path: string, queryObject: QueryObject) {
  return api.requestPromise(path, queryObject);
}

function _handleUnmergeableQuery(queryDefinition: BatchQueryDefinition) {
  const result = requestFunction(
    queryDefinition.api,
    queryDefinition.path,
    queryDefinition.requestQueryObject
  );
  queryDefinition.resolve(result);
}

function _handleUnmergeableQueries(mergeMap: MergeMap) {
  let queriesSent = 0;
  Object.keys(mergeMap).forEach(k => {
    // Using async forEach to ensure calls start in parallel.
    const mergeList = mergeMap[k]!;

    if (mergeList.length === 1) {
      const [queryDefinition] = mergeList;
      queriesSent++;
      _handleUnmergeableQuery(queryDefinition!);
    }
  });

  return queriesSent;
}

function _handleMergeableQueries(mergeMap: MergeMap) {
  let queriesSent = 0;
  Object.keys(mergeMap).forEach(async k => {
    const mergeList = mergeMap[k]!;

    if (mergeList.length <= 1) {
      return;
    }

    const [exampleDefinition] = mergeList;
    const batchProperty = exampleDefinition!.batchProperty;
    const query = {...exampleDefinition!.requestQueryObject.query};
    const requestQueryObject = {...exampleDefinition!.requestQueryObject, query};

    const batchValues: string[] = [];

    mergeList.forEach(q => {
      const batchFieldValue = q.requestQueryObject.query[batchProperty];
      if (Array.isArray(batchFieldValue)) {
        if (batchFieldValue.length > 1) {
          // Omit multiple requests with multi fields (eg. yAxis) for now and run them as single queries
          queriesSent++;
          _handleUnmergeableQuery(q);
          return;
        }
        // Unwrap array value if it is a single value
        batchValues.push(batchFieldValue[0]);
      } else {
        batchValues.push(batchFieldValue);
      }
    });

    requestQueryObject.query[batchProperty] = batchValues;

    queriesSent++;
    const requestPromise = requestFunction(
      exampleDefinition!.api,
      exampleDefinition!.path,
      requestQueryObject
    );

    try {
      const result = await requestPromise;
      // Unmerge back into individual results
      mergeList.forEach(queryDefinition => {
        queryDefinition.resolve(
          (queryDefinition.transform || identity)(result, queryDefinition)
        );
      });
    } catch (e) {
      // On error fail all requests relying on this merged query (for now)
      mergeList.forEach(q => q.reject(e));
    }
  });
  return queriesSent;
}

function handleBatching(
  organization: Organization,
  queries: Record<symbol, BatchQueryDefinition>
) {
  const mergeMap = queriesToMap(queries);

  if (!mergeMap) {
    return;
  }

  let queriesSent = 0;
  queriesSent += _handleUnmergeableQueries(mergeMap);
  queriesSent += _handleMergeableQueries(mergeMap);

  const queriesCollected = Object.values(mergeMap).reduce(
    (acc, mergeList) => acc + mergeList.length,
    0
  );

  const queriesSaved = queriesCollected - queriesSent;

  trackAnalytics('performance_views.landingv3.batch_queries', {
    organization,
    num_collected: queriesCollected,
    num_saved: queriesSaved,
    num_sent: queriesSent,
  });
}

export function GenericQueryBatcher({children}: {children: React.ReactNode}) {
  const queries = useRef<Record<symbol, BatchQueryDefinition>>({});

  const timeoutRef = useRef<number | undefined>(undefined);
  const organization = useOrganization();

  const addQuery = (q: BatchQueryDefinition, id: symbol) => {
    queries.current[id] = q;

    window.clearTimeout(timeoutRef.current);
    // Put batch function in the next macro task to aggregate all requests in this frame.
    timeoutRef.current = window.setTimeout(() => {
      handleBatching(organization, queries.current);
      timeoutRef.current = undefined;
    }, 0);
  };

  // Cleanup timeout after component unmounts.
  useEffect(
    () => () => {
      timeoutRef.current && window.clearTimeout(timeoutRef.current);
    },
    []
  );

  return (
    <GenericQueryBatcherProvider
      value={{
        addQuery,
      }}
    >
      {children}
    </GenericQueryBatcherProvider>
  );
}

type NodeContext = {
  batchProperty: string;
  id: Ref<symbol>;
};

const BatchNodeContext = createContext<NodeContext | undefined>(undefined);

export type QueryBatching = {
  batchRequest: (_: Client, path: string, query: QueryObject) => Promise<any>;
};

// Wraps api request components to collect at most one request per frame / render pass using symbol as a unique id.
// Transforms these requests into an intermediate promise and adds a query definition that the batch function will use.
export function QueryBatchNode(props: {
  batchProperty: string;
  children(_: any): React.ReactNode;
  transform?: Transform;
}) {
  const api = useApi();
  const {batchProperty, children, transform} = props;
  const id = useRef(Symbol());

  let batchContext: QueryBatch;
  try {
    batchContext = _useGenericQueryBatcher();
  } catch (_) {
    return <Fragment>{children({})}</Fragment>;
  }

  function batchRequest(
    _: Client,
    path: string,
    requestQueryObject: QueryObject
  ): Promise<any> {
    const queryPromise = new Promise((resolve, reject) => {
      const queryDefinition: BatchQueryDefinition = {
        resolve,
        reject,
        transform,
        batchProperty,
        path,
        requestQueryObject,
        api,
      };
      batchContext?.addQuery(queryDefinition, id.current);
    });
    return queryPromise;
  }

  const queryBatching: QueryBatching = {
    batchRequest,
  };

  return (
    <BatchNodeContext.Provider
      value={{
        id,
        batchProperty,
      }}
    >
      {children({queryBatching})}
    </BatchNodeContext.Provider>
  );
}
