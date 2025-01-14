import type {Applications, PiiConfig, Rule, RuleDefault} from './types';
import {MethodType, RuleType} from './types';

// Remap PII config format to something that is more usable in React. Ideally
// we would stop doing this at some point and make some updates to how we
// store this configuration on the server.
//
// For the time being the PII config format is documented at
// https://getsentry.github.io/relay/pii-config/

export function convertRelayPiiConfig(relayPiiConfig?: string | null): Rule[] {
  const piiConfig = relayPiiConfig ? JSON.parse(relayPiiConfig) : {};
  const rules: Record<string, PiiConfig> = piiConfig.rules || {};
  const applications: Applications = piiConfig.applications || {};
  const convertedRules: Array<Rule> = [];

  for (const application in applications) {
    for (const rule of applications[application]!) {
      const resolvedRule = rules[rule];
      const id = convertedRules.length;
      const source = application;

      if (!resolvedRule) {
        // Convert a "built-in" rule like "@anything:remove" to an object {
        //   type: "anything",
        //   method: "remove"
        // }
        if (rule[0] === '@') {
          const typeAndMethod = rule.slice(1).split(':');
          let [type] = typeAndMethod;
          const [, method] = typeAndMethod;
          if (type === 'urlauth') {
            type = 'url_auth';
          }
          if (type === 'usssn') {
            type = 'us_ssn';
          }

          convertedRules.push({
            id,
            method: method as RuleDefault['method'],
            type: type as RuleDefault['type'],
            source,
          });
        }
        continue;
      }

      const {type, redaction} = resolvedRule;
      const method = redaction.method;

      if (method === MethodType.REPLACE) {
        if (type === RuleType.PATTERN) {
          convertedRules.push({
            id,
            method: MethodType.REPLACE,
            type: RuleType.PATTERN,
            source,
            placeholder: redaction?.text,
            pattern: resolvedRule.pattern,
          });
        } else {
          convertedRules.push({
            id,
            method: MethodType.REPLACE,
            type,
            source,
            placeholder: redaction?.text,
          });
        }
      } else if (type === RuleType.PATTERN) {
        convertedRules.push({
          id,
          method,
          type: RuleType.PATTERN,
          source,
          pattern: resolvedRule.pattern,
        });
      } else {
        convertedRules.push({id, method, type, source});
      }
    }
  }

  return convertedRules;
}
