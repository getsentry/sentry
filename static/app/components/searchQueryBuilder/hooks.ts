import {parseAsBoolean, useQueryState} from 'nuqs';

export function useCaseInsensitivity(): [boolean | undefined, (c: boolean) => void] {
  const [caseInsensitive, setCaseInsensitive] = useQueryState(
    'caseInsensitive',
    parseAsBoolean
  );

  return [caseInsensitive ?? undefined, setCaseInsensitive];
}
