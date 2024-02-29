import React, {type Dispatch, type SetStateAction, useState} from 'react';

import type {TraceTree, TraceTreeNode} from './traceTree';

type State = {
  node: TraceTreeNode<TraceTree.NodeValue> | undefined;
  setNode: Dispatch<SetStateAction<TraceTreeNode<TraceTree.NodeValue> | undefined>>;
};

export const HighLightedRowContext = React.createContext<State>({
  node: undefined,
  setNode: () => {},
});

export function HighLightedRowContextProvider({children}) {
  const [node, setNode] = useState<TraceTreeNode<TraceTree.NodeValue> | undefined>(
    undefined
  );

  return (
    <HighLightedRowContext.Provider value={{node, setNode}}>
      {children}
    </HighLightedRowContext.Provider>
  );
}
