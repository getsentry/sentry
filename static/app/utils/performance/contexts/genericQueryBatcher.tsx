import type {Ref} from 'react';
import {createContext, Fragment, useRef} from 'react';

import type {Client} from 'sentry/api';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import useApi from 'sentry/utils/useApi';

type QueryObject = {
  includeAllArgs: boolean | undefined;
  query: Record<string, any>;
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

const [_GenericQueryBatcherProvider, _useGenericQueryBatcher] =
  createDefinedContext<QueryBatch>({
    name: 'GenericQueryBatcherContext',
  });

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
    <BatchNodeContext
      value={{
        id,
        batchProperty,
      }}
    >
      {children({queryBatching})}
    </BatchNodeContext>
  );
}
