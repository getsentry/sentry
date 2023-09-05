import {
  Applications,
  MethodType,
  PiiConfig,
  RuleType,
} from 'sentry/views/settings/components/dataScrubbing/types';

export function DataScrubbingRelayPiiConfig(): {
  applications: Applications;
  rules: Record<string, PiiConfig>;
} {
  return {
    rules: {
      0: {
        type: RuleType.PASSWORD,
        redaction: {method: MethodType.REPLACE, text: 'Scrubbed'},
      },
      1: {type: RuleType.CREDITCARD, redaction: {method: MethodType.MASK}},
      2: {
        type: RuleType.PATTERN,
        pattern: '[a-zA-Z0-9]+',
        redaction: {method: MethodType.REPLACE, text: 'Placeholder'},
      },
    },
    applications: {password: ['0'], $message: ['1', '2']},
  };
}
