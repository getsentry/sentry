// Resolve V8 package paths to the existing V6 runtime until the runtime upgrade.
// oxlint-disable-next-line import/export -- V6 DOM re-exports the aliased core; types.d.ts bypasses that cycle.
export * from 'react-router-dom';
export {
  createMemoryHistory as UNSAFE_createMemoryHistory,
  createRouter as UNSAFE_createRouter,
  type Router as DataRouter,
  type InitialEntry,
  type RouterNavigateOptions,
} from '@remix-run/router';
