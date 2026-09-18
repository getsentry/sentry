import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useState} from 'react';
import type {Location} from 'history';

import {useNavigate} from 'sentry/utils/useNavigate';

export interface OnDemandControlContext {
  setForceOnDemand: (value: boolean) => void;
  forceOnDemand?: boolean;
  isControlEnabled?: boolean;
}

const OnDemandControlContext = createContext<OnDemandControlContext | undefined>(
  undefined
);

export function useOnDemandControl(): OnDemandControlContext | undefined {
  return useContext(OnDemandControlContext);
}

export function OnDemandControlProvider({
  children,
  location,
}: {
  children: ReactNode;
  location: Location;
}) {
  const _forceOnDemandQuery = location?.query.forceOnDemand;
  const _forceOnDemand =
    _forceOnDemandQuery === 'true'
      ? true
      : _forceOnDemandQuery === 'false'
        ? false
        : undefined;
  const navigate = useNavigate();
  const [isControlEnabled, setIsControlEnabled] = useState(_forceOnDemand !== undefined);
  const [forceOnDemand, _setForceOnDemand] = useState(_forceOnDemand || false);

  const setForceOnDemand = useCallback(
    (value: boolean) => {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            forceOnDemand: value,
          },
        },
        {replace: true}
      );
      _setForceOnDemand(value);
      setIsControlEnabled(true);
    },
    [navigate, setIsControlEnabled, _setForceOnDemand, location]
  );

  return (
    <OnDemandControlContext value={{setForceOnDemand, isControlEnabled, forceOnDemand}}>
      {children}
    </OnDemandControlContext>
  );
}
