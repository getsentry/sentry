/**
 * React 19 stopped exporting the ReducerAction type, so we need to define our own
 */
export type ReducerAction<R extends React.Reducer<any, any>> =
  R extends React.Reducer<any, infer A> ? A : never;
