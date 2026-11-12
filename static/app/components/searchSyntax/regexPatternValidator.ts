import {t} from 'sentry/locale';

export type RegexPatternValidator = (pattern: string) => string | null;

export async function loadRegexPatternValidator(): Promise<RegexPatternValidator> {
  const {RE2JS, RE2JSSyntaxException} = await import('re2js');

  const invalidRegexReason: RegexPatternValidator = pattern => {
    try {
      RE2JS.compile(pattern);
      return null;
    } catch (error) {
      return error instanceof RE2JSSyntaxException
        ? error.error
        : t('unsupported pattern');
    }
  };

  return invalidRegexReason;
}
