import type {Router} from '@remix-run/router/dist/router';
import * as Sentry from '@sentry/react';
import type {History} from 'history';

import {
  location6ToLocation3,
  locationDescriptorToTo,
} from './reactRouter6Compat/location';

const historyMethods: Array<keyof History> = [
  'listenBefore',
  'listen',
  'transitionTo',
  'push',
  'replace',
  'go',
  'goBack',
  'goForward',
  'createKey',
  'createPath',
  'createHref',
  'createLocation',
  'getCurrentLocation',
];

/**
 * Configures a proxy object for the default value of browserHistory. This
 * should NOT be called before the DANGEROUS_SET_REACT_ROUTER_6_HISTORY
 * fucntion is called. But let's be sure it isn't by adding some logging.
 */
const proxyLegacyBrowserHistory: ProxyHandler<History> = {
  get(_target, prop, _receiver) {
    if (historyMethods.includes(prop.toString() as keyof History)) {
      // eslint-disable-next-line no-console
      console.warn('Legacy browserHistory called before patched!');
      Sentry.captureException(new Error('legacy browserHistory called!'), {
        level: 'info',
        extra: {prop},
      });

      return () => {};
    }
    return undefined;
  },
};

/**
 * @deprecated Prefer using useNavigate
 *
 * browserHistory is a hold-over from react-router 3 days. In react-router 6
 * the useNavigate hook is the native way to trigger navigation events.
 *
 * browserHistory.push('/next')    -> navigate('/next')
 * browserHistory.replace('/next') -> navigate('/next', {replace: true})
 *
 * You may also use a LocationDescriptor object
 *
 * browserHistory.push({...location, query: {someKey: 1}})
 * navigate({...location, query: {someKey: 1}})
 */
export let browserHistory = new Proxy({} as History, proxyLegacyBrowserHistory);

/**
 * This shim sets the global `browserHistory` to a shim object that matches
 * react-router 3's browserHistory implementation
 */
export function DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router: Router) {
  // XXX(epurkhiser): The router object for react-router 6 has a slightly
  // different interface from -router 3 history. We need to shim some of the
  // functions to keep things working
  const compat6BrowserHistory: History = {
    push: to => router.navigate(locationDescriptorToTo(to)),
    replace: to => router.navigate(locationDescriptorToTo(to), {replace: true}),
    go: n => router.navigate(n),
    goBack: () => router.navigate(-1),
    goForward: () => router.navigate(1),

    listen: listener =>
      router.subscribe(state => listener(location6ToLocation3(state.location))),

    listenBefore: _hook => {
      // eslint-disable-next-line no-console
      console.error('browserHistory.listenBefore not implemented on react-router 6 shim');
      return () => {};
    },
    transitionTo: _location => {
      // eslint-disable-next-line no-console
      console.error('browserHistory.transitionTo not implemented on react-router 6 shim');
    },
    createKey: () => {
      // eslint-disable-next-line no-console
      console.error('browserHistory.createKey not implemented on react-router 6 shim');
      return '';
    },
    createPath: () => {
      // eslint-disable-next-line no-console
      console.error('browserHistory.createPath not implemented on react-router 6 shim');
      return '';
    },
    createHref: () => {
      // eslint-disable-next-line no-console
      console.error('browserHistory.createHref not implemented on react-router 6 shim');
      return '';
    },
    createLocation: () => {
      // eslint-disable-next-line no-console
      console.error(
        'browserHistory.createLocation not implemented on react-router 6 shim'
      );
      return undefined as any;
    },
    getCurrentLocation: () => {
      // eslint-disable-next-line no-console
      console.error(
        'browserHistory.getCurrentLocation not implemented on react-router 6 shim'
      );
      return undefined as any;
    },
  };

  browserHistory = compat6BrowserHistory;
}

export function DANGEROUS_SET_TEST_HISTORY(router: any) {
  browserHistory = router;
}
