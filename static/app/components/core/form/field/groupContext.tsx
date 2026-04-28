import {createContext, useContext} from 'react';

const GroupContext = createContext<boolean>(false);

export function GroupProvider({children}: {children: React.ReactNode}) {
  return <GroupContext.Provider value>{children}</GroupContext.Provider>;
}

export function useGroupContext(): boolean {
  return useContext(GroupContext);
}
