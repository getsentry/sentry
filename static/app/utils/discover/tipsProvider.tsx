import {useState} from 'react';

import {TipsContext, TipsContextValue} from './tipsContext';

type TipsProviderProps = {
  children: React.ReactNode | ((props: TipsContextValue) => React.ReactNode);
};

export function TipsProvider({children}: TipsProviderProps) {
  const [state, setState] = useState<TipsContextValue>({tips: []});

  return (
    <TipsContext.Provider value={[state, setState]}>
      {typeof children === 'function' ? children(state) : children}
    </TipsContext.Provider>
  );
}
