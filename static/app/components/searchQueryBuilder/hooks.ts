import {useQueryState} from 'nuqs';

import {parseAsBooleanLiteral} from 'sentry/utils/url/parseAsBooleanLiteral';

export function useCaseInsensitivity() {
  const [caseInsensitive, setCaseInsensitive] = useQueryState(
    'caseInsensitive',
    parseAsBooleanLiteral
  );

  return [caseInsensitive, setCaseInsensitive] as const;
}

export type CaseInsensitive = ReturnType<typeof useCaseInsensitivity>[0];
