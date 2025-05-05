import {createContext, useContext, useState} from 'react';

const Context = createContext<[scale: number, setScale: (scale: number) => void]>([
  1,
  (_scale: number) => {},
]);

export function TimelineScaleContextProvider({children}: {children: React.ReactNode}) {
  const state = useState(1);

  return <Context value={state}>{children}</Context>;
}

export default function useTimelineScale() {
  return useContext(Context);
}
