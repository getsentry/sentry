import {createContext, useState} from 'react';

type Context = {
  concatToggle: boolean;
  isSearching: boolean;
  search: string;
  setConcatToggle: React.Dispatch<React.SetStateAction<boolean>>;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
};

export const BundleContext = createContext<Context | null>(null);

export function BundleContextProvider({children}) {
  const [search, setSearch] = useState('');
  const [concatToggle, setConcatToggle] = useState(false);

  return (
    <BundleContext.Provider
      value={{search, setSearch, isSearching: !!search, concatToggle, setConcatToggle}}
    >
      {children}
    </BundleContext.Provider>
  );
}
