import {createContext, Fragment, Ref, useEffect, useRef} from 'react';

import {Client} from 'app/api';
import useApi from 'app/utils/useApi';

import {createDefinedContext} from './utils';

type QueryObject = {
  query: {
    [k: string]: any;
  };
}; // TODO(k-fish): Fix to ensure exact types for all requests. Simplified type for now, need to pull this in from events file.

type BatchQueryDefinition = {
  requestFunction: () => any;

  // Intermediate promise functions
  resolve: (value: any) => void;
  reject: (reason?: string) => void;

  // Batch query node props
  batchProperty: string;
  pathMatches: string;

  // Query props
  requestQueryObject: QueryObject;
  path: string;
  api: Client;
};

type QueryBatch = {
  addQuery: (q: BatchQueryDefinition, id: symbol) => void;
};

const [GenericQueryBatcherProvider, _useGenericQueryBatcher] =
  createDefinedContext<QueryBatch>({
    name: 'GenericQueryBatcherContext',
  });

function mergeKey(query: BatchQueryDefinition) {
  return `${query.batchProperty}.${query.pathMatches}`;
}

type MergeMap = Record<string, BatchQueryDefinition[]>;

// Builds a map that will contain an array of query definitions by mergeable key (using batch property and path)
function queriesToMap(collectedQueries: Record<symbol, BatchQueryDefinition>) {
  const keys = Reflect.ownKeys(collectedQueries);
  if (!keys.length) {
    return false;
  }
  const mergeMap: MergeMap = {};

  keys.forEach(async key => {
    const query = collectedQueries[key];
    mergeMap[mergeKey(query)] = mergeMap[mergeKey(query)] || [];
    mergeMap[mergeKey(query)].push(query);
    delete collectedQueries[key];
  });

  return mergeMap;
}

function _handleUnmergeableQueries(mergeMap: MergeMap) {
  Object.keys(mergeMap).forEach(async k => {
    // Using async forEach to ensure calls start in parallel.
    const mergeList = mergeMap[k];

    if (mergeList.length !== 1) {
      return;
    }

    const [queryDefinition] = mergeList;
    const result = queryDefinition.requestFunction();
    queryDefinition.resolve(result);
  });
}

function _handleMergeableQueries(mergeMap: MergeMap) {
  // Only remaining keys should be mergable.
  Object.keys(mergeMap).forEach(async k => {
    const mergeList = mergeMap[k];

    if (mergeList.length <= 1) {
      return;
    }

    const [exampleDefinition] = mergeList;

    // Merge into a single query
    const newQuery = exampleDefinition.requestQueryObject;
    const batchProperty = exampleDefinition.batchProperty;

    const batchValues = mergeList.map(q => {
      const v = q.requestQueryObject.query[batchProperty];
      if (Array.isArray(v)) {
        return v[0];
      }
      return v;
    });
    newQuery.query[batchProperty] = batchValues;

    const requestPromise = exampleDefinition.api.requestPromise(
      exampleDefinition.path,
      newQuery
    );

    try {
      const result = await requestPromise;
      // Unmerge back into individual results
      mergeList.forEach(queryDefinition => {
        const propertyName = Array.isArray(
          queryDefinition.requestQueryObject.query[queryDefinition.batchProperty]
        )
          ? queryDefinition.requestQueryObject.query[queryDefinition.batchProperty][0]
          : queryDefinition.requestQueryObject.query[queryDefinition.batchProperty];

        const singleResult = result[propertyName];
        queryDefinition.resolve(singleResult);
      });
    } catch (e) {
      // On error fail all requests relying on this merged query (for now)
      mergeList.forEach(q => q.reject(e));
    }
  });
}

function handleBatching(queries: Record<symbol, BatchQueryDefinition>) {
  const mergeMap = queriesToMap(queries);

  if (!mergeMap) {
    return;
  }

  _handleUnmergeableQueries(mergeMap);
  _handleMergeableQueries(mergeMap);
}

export const GenericQueryBatcher = ({children}: {children: React.ReactNode}) => {
  const queries = useRef<Record<symbol, BatchQueryDefinition>>({});

  const timeoutId = useRef<NodeJS.Timeout | undefined>();

  const addQuery = (q: BatchQueryDefinition, id: symbol) => {
    queries.current[id] = q;

    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = undefined;
    }
    // Put batch function in the next macro task to aggregate all requests in this frame.
    const tID = setTimeout(() => {
      handleBatching(queries.current);
      timeoutId.current = undefined;
    }, 0);
    timeoutId.current = tID;
  };

  useEffect(() => {
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, []);

  return (
    <GenericQueryBatcherProvider
      value={{
        addQuery,
      }}
    >
      {children}
    </GenericQueryBatcherProvider>
  );
};

type nodeContext = {
  id: Ref<Symbol>;
  batchProperty: string;
};

const BatchNodeContext = createContext<nodeContext | undefined>(undefined);

export type QueryBatching = {
  batchRequest: (_: Client, path: string, query: QueryObject) => Promise<any>;
};

export function QueryBatchNode(props: {
  batchProperty: string;
  children(_: any): React.ReactNode;
}) {
  const {batchProperty, children} = props;
  const id = useRef(Symbol());

  let batchContext: QueryBatch;
  try {
    batchContext = _useGenericQueryBatcher();
  } catch (_) {
    return <Fragment>{children({})}</Fragment>;
  }

  const api = useApi();

  function batchRequest(
    _: Client,
    path: string,
    requestQueryObject: QueryObject
  ): Promise<any> {
    const requestFunction = () => api.requestPromise(path, requestQueryObject);
    const queryPromise = new Promise((resolve, reject) => {
      const queryDefinition: BatchQueryDefinition = {
        resolve,
        reject,
        requestFunction,
        batchProperty,
        pathMatches: path,
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
