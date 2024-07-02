import {createContext, useContext, useState} from 'react';

const context = createContext<[scale: number, setScale: (scale: number) => void]>([
  1,
  (_scale: number) => {},
]);

export function TimelineScaleContextProvider({children}: {children: React.ReactNode}) {
  const state = useState(1);

  return <context.Provider value={state}>{children}</context.Provider>;
}

export default function useTimelineScale() {
  return useContext(context);
}
