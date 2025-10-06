import {createContext, useContext} from 'react';

export type PreventContextData = {
  changeContextValue: (value: Partial<PreventContextDataParams>) => void;
  preventPeriod: string;
  branch?: string | null;
  integratedOrgId?: string;
  integratedOrgName?: string;
  lastVisitedOrgId?: string;
  repository?: string;
};

export type PreventContextDataParams = Omit<
  PreventContextData,
  'changeContextValue' | 'lastVisitedOrgId'
>;

export const PreventContext = createContext<PreventContextData | undefined>(undefined);

export function usePreventContext() {
  const context = useContext(PreventContext);
  if (context === undefined)
    throw new Error('usePreventContext was called outside of PreventProvider');
  return context;
}
