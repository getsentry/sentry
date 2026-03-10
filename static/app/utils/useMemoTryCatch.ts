import {useMemo} from 'react';

export function useMemoTryCatch<Result, Arg>(compute: (arg: Arg) => Result, arg: Arg) {
  return useMemo(() => {
    try {
      return [compute(arg)] as const;
    } catch (error) {
      return [undefined, error] as const;
    }
  }, [arg, compute]);
}
