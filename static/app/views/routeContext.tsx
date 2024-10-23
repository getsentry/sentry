import {createContext} from 'react';

import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';

/**
 * This is a legacy context that is primarily used in tests currently to allow
 * for mocking the use{Location,Navigate,Routes,Params} hooks
 *
 * DO NOT use this outside of tests!
 */
export const RouteContext = createContext<RouteContextInterface | null>(null);
