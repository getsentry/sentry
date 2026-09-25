export type RegexPatternValidator = (pattern: string) => boolean;

let validatorPromise: Promise<RegexPatternValidator> | undefined;

/**
 * ClickHouse matches with RE2, which rejects syntax native JS accepts (lookaround,
 * backreferences) and accepts syntax it rejects (`\pL`, `\z`), so only RE2 can vouch for a
 * pattern before it reaches the backend.
 */
export function loadRegexPatternValidator(): Promise<RegexPatternValidator> {
  validatorPromise ??= import('re2js').then(({RE2JS}) => (pattern: string) => {
    try {
      RE2JS.compile(pattern);
      return true;
    } catch {
      return false;
    }
  });

  return validatorPromise;
}
