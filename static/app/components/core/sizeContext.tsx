import {createContext, useContext} from 'react';

type SizeVariant = 'zero' | 'xs' | 'sm' | 'md';

const SizeContext = createContext<SizeVariant | undefined>(undefined);

export function SizeProvider({
  size,
  children,
}: {
  children: React.ReactNode;
  size: SizeVariant;
}) {
  return <SizeContext value={size}>{children}</SizeContext>;
}

export function useSizeContext(): SizeVariant | undefined {
  return useContext(SizeContext);
}
