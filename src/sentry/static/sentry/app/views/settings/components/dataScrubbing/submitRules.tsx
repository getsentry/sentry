import {Client} from 'app/api';

import {RuleType, MethodType, PiiConfig, Applications, Rule} from './types';

function getSubmitFormatRule(rule: Rule): PiiConfig {
  if (rule.type === RuleType.PATTERN && rule.method === MethodType.REPLACE) {
    return {
      type: rule.type,
      pattern: rule.pattern,
      redaction: {
        method: rule.method,
        text: rule?.placeholder,
      },
    };
  }

  if (rule.type === RuleType.PATTERN) {
    return {
      type: rule.type,
      pattern: rule.pattern,
      redaction: {
        method: rule.method,
      },
    };
  }

  if (rule.method === MethodType.REPLACE) {
    return {
      type: rule.type,
      redaction: {
        method: rule.method,
        text: rule?.placeholder,
      },
    };
  }

  return {
    type: rule.type,
    redaction: {
      method: rule.method,
    },
  };
}

function submitRules(api: Client, endpoint: string, rules: Array<Rule>) {
  const applications: Applications = {};
  const submitFormatRules: Record<string, PiiConfig> = {};

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const ruleId = String(i);
    submitFormatRules[ruleId] = getSubmitFormatRule(rule);

    if (!applications[rule.source]) {
      applications[rule.source] = [];
    }

    if (!applications[rule.source].includes(ruleId)) {
      applications[rule.source].push(ruleId);
    }
  }

  const piiConfig = {rules: submitFormatRules, applications};

  return api.requestPromise(endpoint, {
    method: 'PUT',
    data: {relayPiiConfig: JSON.stringify(piiConfig)},
  });
}

export default submitRules;
