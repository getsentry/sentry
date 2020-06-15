import {RuleType, MethodType, Rule, PiiConfig, Applications} from './types';

// Remap PII config format to something that is more usable in React. Ideally
// we would stop doing this at some point and make some updates to how we
// store this configuration on the server.
//
// For the time being the PII config format is documented at
// https://getsentry.github.io/relay/pii-config/

function convertRelayPiiConfig(relayPiiConfig?: string) {
  const piiConfig = relayPiiConfig ? JSON.parse(relayPiiConfig) : {};
  const rules: PiiConfig = piiConfig.rules || {};
  const applications: Applications = piiConfig.applications || {};
  const convertedRules: Array<Rule> = [];

  for (const application in applications) {
    for (const rule of applications[application]) {
      const resolvedRule = rules[rule];
      const id = convertedRules.length;

      if (!resolvedRule) {
        // Convert a "built-in" rule like "@anything:remove" to an object {
        //   type: "anything",
        //   method: "remove"
        // }
        if (rule[0] === '@') {
          const [type, method] = rule.slice(1).split(':') as [RuleType, MethodType];
          convertedRules.push({
            id,
            method,
            type,
            source: application,
          });
        }
        continue;
      }

      const {type, redaction} = resolvedRule;
      const method = redaction.method as MethodType;

      if (resolvedRule.type === RuleType.PATTERN && resolvedRule?.pattern) {
        convertedRules.push({
          id,
          method,
          type: RuleType.PATTERN,
          source: application,
          customRegularExpression: resolvedRule.pattern,
        });
        continue;
      }

      convertedRules.push({id, method, type, source: application});
    }
  }

  return convertedRules;
}

export default convertRelayPiiConfig;
