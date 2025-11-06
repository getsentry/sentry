import {createContext, useContext} from 'react';
import type {RouteObject} from 'react-router-dom';

const RouteConfigContext = createContext<RouteObject[]>([]);

export const RouteConfigProvider = RouteConfigContext.Provider;

export function useRouteConfig() {
  return useContext(RouteConfigContext);
}
