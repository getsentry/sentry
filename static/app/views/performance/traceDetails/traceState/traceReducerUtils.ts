// Ensure that TS will throw an error if we forget to handle a reducer action case.
// We do this because the reducer is combined with other reducers and we want to ensure
// that we handle all possible actions from inside this reducer.
export function traceReducerExhaustiveActionCheck(_x: never): void {}
