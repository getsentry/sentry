import {createContext} from 'react';
import {RouteContextInterface} from 'react-router';

// TODO(nisanthan): Better types. Context will be the `props` arg from the RouterProps render method. This is typed as `any` by react-router
export const RouteContext = createContext<RouteContextInterface | null>(null);
