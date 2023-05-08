import {useState} from 'react';

type StarfishOptions = {
  useDiscover: boolean;
};

export function useStarfishOptions() {
  const [options, setOptions] = useState<StarfishOptions>({useDiscover: false});
  return {options, setOptions};
}
