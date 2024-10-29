import {createContext, type ReactNode, useContext} from 'react';

export const SurfaceContext = createContext<string>('');

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
