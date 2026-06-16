import {createContext, useContext, useState} from 'react';

// Will be fixed by https://github.com/typescript-eslint/typescript-eslint/pull/12206
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
const Context = createContext<[scale: number, setScale: (scale: number) => void]>([
  1,
  (_scale: number) => {},
]);

export function TimelineScaleContextProvider({children}: {children: React.ReactNode}) {
  const state = useState(1);

  return <Context value={state}>{children}</Context>;
}

export function useTimelineScale() {
  return useContext(Context);
}
