import {Client} from 'app/api';

import {RuleType, MethodType, Rule} from './types';

type PiiConfig = {
  type: RuleType;
  pattern: string;
  redaction?: {
    method?: MethodType;
  };
};

type PiiConfigRule = Record<string, PiiConfig>;
type Applications = Record<string, Array<string>>;

function submitRule(api: Client, endpoint: string, rule: Rule) {
  const applications: Applications = {};
  const customRules: PiiConfigRule = {};

  let ruleName = `@${rule.type}:${rule.method}`;

  if (rule.type === RuleType.PATTERN && rule.customRegex) {
    ruleName = `customRule${ruleName}`;

    customRules[ruleName] = {
      type: RuleType.PATTERN,
      pattern: rule.customRegex,
      redaction: {
        method: rule.method,
      },
    };
  }

  if (!applications[rule.source]) {
    applications[rule.source] = [];
  }

  if (!applications[rule.source].includes(ruleName)) {
    applications[rule.source].push(ruleName);
  }

  const piiConfig = {
    rules: customRules,
    applications,
  };

  const relayPiiConfig = JSON.stringify(piiConfig);

  return api.requestPromise(endpoint, {
    method: 'PUT',
    data: {relayPiiConfig},
  });
}

export {submitRule};
