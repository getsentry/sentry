import {createRouter as createReactRouter, type RouterInit} from '@remix-run/router';

export {
  createMemoryHistory,
  type InitialEntry,
  type Router,
  type RouterNavigateOptions,
} from '@remix-run/router';

export function createRouter(options: Omit<RouterInit, 'future'>) {
  return createReactRouter({
    ...options,
    future: {v7_prependBasename: true},
  });
}
