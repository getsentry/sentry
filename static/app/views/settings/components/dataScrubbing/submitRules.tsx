import {Client} from 'sentry/api';

import {Applications, MethodType, PiiConfig, Rule, RuleType} from './types';

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
    // @ts-expect-error TS(2345) FIXME: Argument of type 'Rule | undefined' is not assigna... Remove this comment to see the full error message
    submitFormatRules[ruleId] = getSubmitFormatRule(rule);

    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    if (!applications[rule.source]) {
      // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
      applications[rule.source] = [];
    }

    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    if (!applications[rule.source].includes(ruleId)) {
      // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
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
