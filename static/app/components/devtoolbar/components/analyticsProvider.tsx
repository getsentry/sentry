import {createContext, type ReactNode, useContext} from 'react';

export const AnalyticsContext = createContext<{eventKey: string; eventName: string}>({
  eventName: 'devtoolbar',
  eventKey: 'devtoolbar',
});

export default function AnalyticsProvider({
  children,
  keyVal,
  nameVal,
}: {
  children: ReactNode;
  keyVal: string;
  nameVal: string;
}) {
  const {eventKey, eventName} = useContext(AnalyticsContext);
  return (
    <AnalyticsContext.Provider
      value={{eventName: eventName + ' ' + nameVal, eventKey: eventKey + '.' + keyVal}}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}
