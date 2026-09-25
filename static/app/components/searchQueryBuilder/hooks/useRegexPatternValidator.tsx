import {useEffect, useState} from 'react';

import type {RegexPatternValidator} from 'sentry/components/searchSyntax/regexPatternValidator';
import {loadRegexPatternValidator} from 'sentry/components/searchSyntax/regexPatternValidator';

export function useRegexPatternValidator(
  enabled: boolean
): RegexPatternValidator | undefined {
  const [validator, setValidator] = useState<RegexPatternValidator>();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    loadRegexPatternValidator().then(loaded => setValidator(() => loaded));
  }, [enabled]);

  return validator;
}
