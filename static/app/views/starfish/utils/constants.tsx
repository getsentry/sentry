// This constant is to be used as an arg for `getInterval`.
// 'metrics' fidelity is intended to match the granularities of stored metrics.
// This gives us the best/highest fidelity of data for minimum amount of work (don't need to merge buckets).
export const STARFISH_CHART_INTERVAL_FIDELITY = 'metrics';

// Key for fetching and setting the selected Starfish project in localstorage
export const STARFISH_PROJECT_KEY = 'starfish-project-selection';
