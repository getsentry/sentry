import {parseAsNumberLiteral, useQueryState} from 'nuqs';

export function useCaseInsensitivity() {
  const [caseInsensitive, setCaseInsensitive] = useQueryState(
    'caseInsensitive',
    parseAsNumberLiteral([1])
  );

  return [caseInsensitive, setCaseInsensitive] as const;
}

export type CaseInsensitive = ReturnType<typeof useCaseInsensitivity>[0];

export type SetCaseInsensitive = ReturnType<typeof useCaseInsensitivity>[1];
