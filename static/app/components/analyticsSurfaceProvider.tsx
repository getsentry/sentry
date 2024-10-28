import {createContext, type ReactNode, useContext} from 'react';

const AnalyticsSurfaceContext = createContext<string | undefined>(undefined);

export function useAnalyticsSurface(): string {
  const surface = useContext(AnalyticsSurfaceContext);
  if (!surface) {
    throw new Error(
      'Undefined surface! Please use AnalyticsSurfaceProvider as a context provider.'
    );
  }
  return surface;
}

export default function AnalyticsSurfaceProvider({
  children,
  suffix,
}: {
  children: ReactNode;
  suffix: string;
}) {
  const parent = useContext(AnalyticsSurfaceContext);
  const surface = parent ? `${parent}.${suffix}` : suffix;

  return (
    <AnalyticsSurfaceContext.Provider value={surface}>
      {children}
    </AnalyticsSurfaceContext.Provider>
  );
}
