import {createContext, type ReactNode, useContext} from 'react';

const SurfaceContext = createContext<string | undefined>(undefined);

export function useSurface(): string {
  const surface = useContext(SurfaceContext);
  if (!surface) {
    // eslint-disable-next-line no-console
    console.error('Undefined surface! Please use SurfaceProvider as a context provider.');
  }
  return surface || '';
}

export default function SurfaceProvider({
  children,
  suffix,
}: {
  children: ReactNode;
  suffix: string;
}) {
  const parent = useContext(SurfaceContext);
  const surface = parent ? `${parent}.${suffix}` : suffix;

  return <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>;
}
