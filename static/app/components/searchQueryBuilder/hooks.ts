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

export function useCaseInsensitivity() {
  const [caseInsensitive, setCaseInsensitive] = useQueryState(
    'caseInsensitive',
    parseAsCaseInsensitive
  );

  return [caseInsensitive, setCaseInsensitive] as const;
}

export type CaseInsensitive = ReturnType<typeof useCaseInsensitivity>[0];
