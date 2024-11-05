import {createContext, type ReactNode, useContext} from 'react';

export const SurfaceContext = createContext<string>('');

export default function SurfaceProvider({
  children,
  value,
  overrideParent = false,
}: {
  children: ReactNode;
  value: string;
  overrideParent?: boolean;
}) {
  const parentSurface = useContext(SurfaceContext);
  const surface = overrideParent || !parentSurface ? value : `${parentSurface}.${value}`;

  return <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>;
}
