import {createContext, useContext} from 'react';
import {createParser, useQueryState} from 'nuqs';

function parseCaseInsensitive(value: string): boolean | null {
  if (value === '1') {
    return true;
  }
  if (value === '0') {
    return false;
  }
  return null;
}

const parseAsCaseInsensitive = createParser({
  parse: parseCaseInsensitive,
  serialize: (value: boolean) => (value ? '1' : '0'),
});

export const CaseInsensitivityDefaultContext = createContext<boolean | null>(null);

export function useCaseInsensitivityParam() {
  return useQueryState('caseInsensitive', parseAsCaseInsensitive);
}

export function useCaseInsensitivity() {
  const [caseInsensitive, setCaseInsensitive] = useCaseInsensitivityParam();
  const defaultCaseInsensitive = useContext(CaseInsensitivityDefaultContext);

  return [caseInsensitive ?? defaultCaseInsensitive, setCaseInsensitive] as const;
}

export type CaseInsensitive = ReturnType<typeof useCaseInsensitivity>[0];
