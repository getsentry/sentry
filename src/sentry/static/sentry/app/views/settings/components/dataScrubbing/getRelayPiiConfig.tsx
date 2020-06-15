import {RuleType, PiiConfig, Rule} from './types';

type Applications = Record<string, Array<string>>;

function getCustomRule(rule: Rule): PiiConfig {
  if (rule.type === RuleType.PATTERN) {
    return {
      type: rule.type,
      pattern: rule?.customRegularExpression,
      redaction: {
        method: rule.method,
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

function getRelayPiiConfig(rules: Array<Rule>) {
  const applications: Applications = {};
  const customRules: Record<string, PiiConfig> = {};

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const ruleId = String(i);
    customRules[ruleId] = getCustomRule(rule);

    if (!applications[rule.source]) {
      applications[rule.source] = [];
    }

    if (!applications[rule.source].includes(ruleId)) {
      applications[rule.source].push(ruleId);
    }
  }

  const piiConfig = {rules: customRules, applications};

  return JSON.stringify(piiConfig);
}

export default getRelayPiiConfig;
