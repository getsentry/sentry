import {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {PlainRoute} from 'react-router';

import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';

type ExplicitTitleProps = {
  routes: PlainRoute[];
  title: string;
};

type PathMap = Record<string, string>;

type Context = {
  /**
   * Represents a mapping of paths to breadcrumb names
   */
  pathMap: PathMap;
  /**
   * Set's an explicit breadcrumb title at the provided routes path.
   *
   * You should call the returned cleanup function to have the explicit title
   * removed when appropriate (typically on unmount of the route component)
   */
  setExplicitTitle: (update: ExplicitTitleProps) => () => void;
};

const BreadcrumbContext = createContext<Context | undefined>(undefined);

type ProviderProps = {
  children: React.ReactNode;
};

function BreadcrumbProvider({children}: ProviderProps) {
  const routes = useRoutes();

  // Maps path strings to breadcrumb names
  const [pathMap, setPathMap] = useState<PathMap>({});

  // The explicit path map is used when we override the name for a specific
  // route. We keep this separate from the path map which is resolved from the
  // `routes` match array so that that does not override an explicit title
  const [explicitPathMap, setExplicitPathMap] = useState<PathMap>({});

  // When our routes change update the path mapping
  useEffect(
    () =>
      setPathMap(oldPathMap => {
        const routePath = getRouteStringFromRoutes(routes);
        const newPathMap = {...oldPathMap};

        for (const fullPath in newPathMap) {
          if (!routePath.startsWith(fullPath)) {
            delete newPathMap[fullPath];
          }
        }

        return newPathMap;
      }),
    [routes, setPathMap]
  );

  const setExplicitTitle = useCallback(
    ({routes: updateRoutes, title}: ExplicitTitleProps) => {
      const key = getRouteStringFromRoutes(updateRoutes);

      setExplicitPathMap(lastState => ({...lastState, [key]: title}));

      return () =>
        setExplicitPathMap(lastState => {
          const {[key]: _removed, ...newExplicitPathMap} = lastState;
          return newExplicitPathMap;
        });
    },
    [setExplicitPathMap]
  );

  const ctx: Context = {
    pathMap: {...pathMap, ...explicitPathMap},
    setExplicitTitle,
  };

  return <BreadcrumbContext.Provider value={ctx}>{children}</BreadcrumbContext.Provider>;
}

/**
 * Provides the mapping of paths to breadcrumb titles.
 *
 * Outside of the BreadcrumbContext this will return an empty mapping
 */
function useBreadcrumbsPathmap() {
  return useContext(BreadcrumbContext)?.pathMap ?? {};
}

/**
 * Used to set the breadcrumb title of the passed route while the current
 * component is rendererd.
 *
 * Is a no-op if used outside of the BreadcrumbContext.
 */
function useBreadcrumbTitleEffect(props: ExplicitTitleProps) {
  const context = useContext(BreadcrumbContext);
  const setExplicitTitle = context?.setExplicitTitle;

  useEffect(() => setExplicitTitle?.(props), [setExplicitTitle, props]);
}

export {BreadcrumbProvider, useBreadcrumbsPathmap, useBreadcrumbTitleEffect};
