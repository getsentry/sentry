import {createContext, Fragment, Ref, useEffect, useRef} from 'react';

import {Client} from 'app/api';
import useApi from 'app/utils/useApi';

import {createDefinedContext} from './utils';

type BatchQueryDefinition = {
  resolve: (value: any) => void;
  reject: (reason?: string) => void;
  fallback: () => any;
  isFulfilled: boolean;
  batchProperty: string;
  pathMatches: string;
  query: any;
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

function handleBatching(queries: Record<symbol, BatchQueryDefinition>) {
  const keys = Reflect.ownKeys(queries);
  if (!keys.length) {
    return;
  }
  const mergeMap = {};

  keys.forEach(async key => {
    const query = queries[key];
    mergeMap[mergeKey(query)] = mergeMap[mergeKey(query)] || [];
    mergeMap[mergeKey(query)].push(query);
    delete queries[key];
  });

  Object.keys(mergeMap).forEach(async k => {
    const value = mergeMap[k];
    if (value.length <= 1) {
      // Run unmergable queries (<= 1)
      delete mergeMap[k];
      if (value.length === 1) {
        const query = value[0];
        const result = value[0].fallback();
        await result;
        query.isFulfilled = true;
        query.resolve(result);
      }
      return;
    }
  });

  // Only remaining keys should be mergable.
  Object.keys(mergeMap).forEach(async k => {
    const mergeList = mergeMap[k];
    const first = mergeList[0];

    // Merge into a single query
    const newQuery = first.query;
    const batchProperty = first.batchProperty;
    const batchValues = mergeList.map(q => {
      const v = q.query.query[batchProperty];
      if (Array.isArray(v)) {
        return v[0];
      }
      return v;
    });
    newQuery.query[batchProperty] = batchValues;

    const requestPromise = first.api.requestPromise(first.path, newQuery);
    const result = await requestPromise;

    // Unmerge back into individual results
    mergeList.forEach(q => {
      const propertyName = Array.isArray(q.query.query[q.batchProperty])
        ? q.query.query[q.batchProperty][0]
        : q.query.query[q.batchProperty];
      const singleResult = result[propertyName];
      q.isFulfilled = true;
      q.resolve(singleResult);
    });
  });
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

const batchNodeContext = createContext<nodeContext | undefined>(undefined);

export type QueryBatching = {
  batchRequest: (_: Client, path: string, query: Record<string, any>) => Promise<any>;
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

  function batchRequest(_: Client, path: string, query: Object): Promise<any> {
    const fallback = () => api.requestPromise(path, query);
    return new Promise((resolve, reject) => {
      const queryDefinition: BatchQueryDefinition = {
        resolve,
        reject,
        fallback,
        isFulfilled: false,
        batchProperty,
        pathMatches: path,
        path,
        query,
        api,
      };
      batchContext?.addQuery(queryDefinition, id.current);
    });
  }

  const queryBatching: QueryBatching = {
    batchRequest,
  };

  return (
    <batchNodeContext.Provider
      value={{
        id,
        batchProperty,
      }}
    >
      {children({queryBatching})}
    </batchNodeContext.Provider>
  );
}
