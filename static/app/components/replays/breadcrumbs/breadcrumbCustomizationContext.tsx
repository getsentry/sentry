import {createContext, type ReactNode, useContext, useMemo} from 'react';

import type {ReplayFrame} from 'sentry/utils/replays/types';

type Props = {
  children: React.ReactNode;
  renderProjectInfo?: (frameInfo: {frame: ReplayFrame}) => ReactNode;
  renderTitle?: (frameInfo: {frame: ReplayFrame}) => ReactNode;
};

type BreadcrumbCustomizationContextType = Omit<Props, 'children'>;

const BreadcrumbCustomizationContext = createContext<BreadcrumbCustomizationContextType>(
  {}
);

export function BreadcrumbCustomizationProvider({
  children,
  renderTitle,
  renderProjectInfo,
}: Props) {
  const value = useMemo(
    () => ({renderTitle, renderProjectInfo}),
    [renderProjectInfo, renderTitle]
  );

  return (
    <BreadcrumbCustomizationContext.Provider value={value}>
      {children}
    </BreadcrumbCustomizationContext.Provider>
  );
}

export const useBreadcrumbCustomizationContext = () =>
  useContext(BreadcrumbCustomizationContext);
