import {useEffect, useState} from 'react';

import type {RegexPatternValidator} from 'sentry/components/searchSyntax/regexPatternValidator';
import {loadRegexPatternValidator} from 'sentry/components/searchSyntax/regexPatternValidator';

/**
 * Parsing is synchronous, so the engine loads up front rather than being awaited inside
 * the parser. Patterns parse as valid until it resolves.
 */
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
