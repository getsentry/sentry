import {parseAsBoolean, useQueryState} from 'nuqs';

export function useCaseInsensitivity() {
  const [caseInsensitive, setCaseInsensitive] = useQueryState(
    'caseInsensitive',
    parseAsBoolean
  );

  return [caseInsensitive ?? undefined, setCaseInsensitive] as const;
}
