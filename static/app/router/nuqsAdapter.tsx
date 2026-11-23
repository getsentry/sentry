import {useLocation} from 'react-router';
import {
  unstable_createAdapterProvider as createAdapterProvider,
  type unstable_AdapterInterface as AdapterInterface,
} from 'nuqs/adapters/custom';
import {NuqsAdapter as ReactRouterNuqsAdapter} from 'nuqs/adapters/react-router/v8';

// Calling the provider only builds its context element; nothing renders.
// eslint-disable-next-line @sentry/no-calling-components-as-functions
const useReactRouterAdapter = ReactRouterNuqsAdapter({children: null}).props.value
  .useAdapter;

// nuqs's own search params update in a transition, so they commit a render after the router location.
function useRouterLocationAdapter(watchKeys: string[]): AdapterInterface {
  const adapter = useReactRouterAdapter(watchKeys);
  const {search} = useLocation();

  // nuqs skips render-time reconciles across pathnames, a guard only router transitions need.
  return {...adapter, searchParams: new URLSearchParams(search), pathname: ''};
}

export const NuqsAdapter = createAdapterProvider(useRouterLocationAdapter);
