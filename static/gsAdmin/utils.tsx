import moment from 'moment-timezone';

import ConfigStore from 'sentry/stores/configStore';

export const prettyDate = (x: moment.MomentInput) => moment(x).format('ll');

export const isBillingAdmin = () => {
  const user = ConfigStore.get('user');
  return !!user?.permissions?.has('billing.admin');
};

// Cryptic words for promo code generation
const CRYPTIC_WORDS = [
  'shadow',
  'mystic',
  'cipher',
  'stealth',
  'vortex',
  'nexus',
  'phantom',
  'quantum',
  'matrix',
  'eclipse',
  'zenith',
  'fusion',
  'vertex',
  'prism',
  'flux',
  'nova',
  'cosmic',
  'azure',
  'ember',
  'frost',
  'onyx',
  'storm',
  'blaze',
  'spark',
  'mist',
  'void',
  'core',
  'byte',
  'node',
  'link',
  'grid',
  'arch',
];

// Character substitutions for l33t speak effect
const CHAR_SUBSTITUTIONS: Record<string, string[]> = {
  a: ['@', '4'],
  e: ['3'],
  i: ['1', '!'],
  o: ['0'],
  s: ['5', '$'],
  t: ['7'],
  l: ['1'],
  g: ['9'],
  b: ['8'],
};

/**
 * Generates a cryptic promo code with one word and random characters
 * @returns A random promo code between 10-15 characters long
 */
export function generatePromoCode(): string {
  // Select one random word
  const word = CRYPTIC_WORDS[Math.floor(Math.random() * CRYPTIC_WORDS.length)] || 'code';

  // Apply character substitutions to the word (30% chance per applicable character)
  let processedWord = word
    .split('')
    .map(char => {
      const lowerChar = char.toLowerCase();
      if (CHAR_SUBSTITUTIONS[lowerChar] && Math.random() < 0.3) {
        const substitutions = CHAR_SUBSTITUTIONS[lowerChar];
        return substitutions[Math.floor(Math.random() * substitutions.length)];
      }
      return char;
    })
    .join('');

  // Generate random characters (letters, numbers, symbols)
  const randomChars = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%&*+=';
  const generateRandomString = (length: number): string => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    return result;
  };

  // Target length between 10-15 characters
  const targetLength = Math.floor(Math.random() * 6) + 10; // 10-15
  const remainingLength = targetLength - processedWord.length;

  // If word is already too long, truncate and add minimal random chars
  if (remainingLength < 2) {
    processedWord = processedWord.substring(0, Math.min(processedWord.length, 8));
    const minRandom = targetLength - processedWord.length;
    return processedWord + generateRandomString(Math.max(minRandom, 2));
  }

  // Decide word position: 0 = prefix, 1 = suffix, 2 = middle
  const position = Math.floor(Math.random() * 3);

  let code = '';

  if (position === 0) {
    // Word as prefix
    code = processedWord + generateRandomString(remainingLength);
  } else if (position === 1) {
    // Word as suffix
    code = generateRandomString(remainingLength) + processedWord;
  } else {
    // Word in middle
    const beforeLength = Math.floor(remainingLength / 2);
    const afterLength = remainingLength - beforeLength;
    code =
      generateRandomString(beforeLength) +
      processedWord +
      generateRandomString(afterLength);
  }

  // Ensure we're within bounds (10-15 characters)
  if (code.length > 15) {
    code = code.substring(0, 15);
  }
  if (code.length < 10) {
    code += generateRandomString(10 - code.length);
  }

  return code;
}

type QueryConditions = {
  organizationId?: string;
  projectId?: string;
};

export function getLogQuery(type: string, conditions: QueryConditions) {
  let query = '';
  let fields = '';

  if (type === 'api') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels.name = "sentry.access.api"
    labels."k8s-pod/service" = "getsentry"
    jsonPayload.event != ""`;
    fields = 'jsonPayload/path,jsonPayload/tokenType';
  } else if (type === 'audit') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels."k8s-pod/service" = "getsentry"
    (labels.name = "sentry.audit.api" OR labels.name = "sentry.audit.ui")
    jsonPayload.event != ""`;
    fields = 'jsonPayload/event,jsonPayload/actor_label,jsonPayload/username';
  } else if (type === 'email') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels."k8s-pod/service" = "getsentry"
    jsonPayload.event != ""
    jsonPayload.name = "sentry.mail"`;
    fields = 'jsonPayload/message_to,jsonPayload/message_type,jsonPayload/event';
  } else if (type === 'billing') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels.name = "getsentry.billing"
    labels."k8s-pod/service" = "getsentry"
    jsonPayload.event != ""`;
    fields =
      'jsonPayload/event,jsonPayload/reserved_events,jsonPayload/plan,jsonPayload/ondemand_spend';
  } else if (type === 'auth') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels."k8s-pod/service" = "getsentry"
    labels.name = "sentry.auth"
    jsonPayload.event != ""`;
    fields = 'jsonPayload/event,jsonPayload/username';
  } else if (type === 'project') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels."k8s-pod/service" = "getsentry"
    jsonPayload.event != ""`;
    fields = 'jsonPayload/event';
  } else if (type === 'organization') {
    query = `resource.type = k8s_container
    resource.labels.namespace_name = default
    resource.labels.container_name = sentry
    labels."k8s-pod/service" = "getsentry"
    jsonPayload.event != ""`;
    fields = 'jsonPayload/event';
  } else {
    throw new Error(`Unknown query type of ${query}`);
  }

  if (conditions.organizationId) {
    query += `\njsonPayload.organization_id = ${conditions.organizationId}`;
  }
  if (conditions.projectId) {
    query += `\njsonPayload.project_id = ${conditions.projectId}`;
  }
  const logBase = 'https://console.cloud.google.com/logs/query';
  query = encodeURIComponent(query);
  fields = encodeURIComponent(fields);

  return `${logBase};query=${query};summaryFields=${fields}`;
}
