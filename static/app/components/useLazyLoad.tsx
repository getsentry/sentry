import {useEffect, useState} from 'react';

type Opts = {
  loader: () => Promise<any>;
};

export default function useLazyLoad({loader}: Opts) {
  const [mod, setMod] = useState<any>();

  useEffect(() => {
    if (!mod) {
      loader().then(setMod);
    }
  }, [mod, loader]);

  return mod;
}
