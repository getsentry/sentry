import {css} from '@emotion/react';

import {t, tct} from 'sentry/locale';
import {
  LegacyBrowser,
  SamplingConditionLogicalInner,
  SamplingInnerName,
  SamplingInnerOperator,
  SamplingRule,
} from 'sentry/types/sampling';
import theme from 'sentry/utils/theme';

import {
  getInnerNameLabel,
  isCustomTagName,
  LEGACY_BROWSER_LIST,
  stripCustomTagPrefix,
} from '../utils';

import Conditions from './conditions';
import {TruncatedLabel} from './truncatedLabel';

type Condition = React.ComponentProps<typeof Conditions>['conditions'][0];

export const modalCss = css`
  [role='document'] {
    overflow: initial;
  }

  @media (min-width: ${theme.breakpoints.small}) {
    width: 100%;
    max-width: 700px;
  }
`;

export enum Transaction {
  ALL = 'all',
  MATCH_CONDITIONS = 'match-conditions',
}

export function isLegacyBrowser(
  maybe: Array<string> | Array<LegacyBrowser>
): maybe is Array<LegacyBrowser> {
  return maybe.every(m => !!LEGACY_BROWSER_LIST[m]);
}

export function getMatchFieldPlaceholder(category: SamplingInnerName | string) {
  switch (category) {
    case SamplingInnerName.EVENT_LEGACY_BROWSER:
      return t('Match all selected legacy browsers below');
    case SamplingInnerName.EVENT_BROWSER_EXTENSIONS:
      return t('Match all browser extensions');
    case SamplingInnerName.EVENT_LOCALHOST:
      return t('Match all localhosts');
    case SamplingInnerName.EVENT_WEB_CRAWLERS:
      return t('Match all web crawlers');
    case SamplingInnerName.EVENT_USER_ID:
    case SamplingInnerName.TRACE_USER_ID:
      return t('ex. 4711 (Multiline)');
    case SamplingInnerName.EVENT_USER_SEGMENT:
    case SamplingInnerName.TRACE_USER_SEGMENT:
      return t('ex. paid, common (Multiline)');
    case SamplingInnerName.TRACE_ENVIRONMENT:
    case SamplingInnerName.EVENT_ENVIRONMENT:
      return t('ex. prod, dev');
    case SamplingInnerName.TRACE_RELEASE:
    case SamplingInnerName.EVENT_RELEASE:
      return t('ex. 1*, [I3].[0-9].*');
    case SamplingInnerName.EVENT_IP_ADDRESSES:
      return t('ex. 127.0.0.1 or 10.0.0.0/8 (Multiline)');
    case SamplingInnerName.EVENT_CSP:
      return t('ex. file://*, example.com (Multiline)');
    case SamplingInnerName.TRACE_TRANSACTION:
    case SamplingInnerName.EVENT_TRANSACTION:
      return t('ex. page-load');
    case SamplingInnerName.EVENT_OS_NAME:
      return t('ex. Mac OS X, Windows');
    case SamplingInnerName.EVENT_OS_VERSION:
      return t('ex. 11, 9* (Multiline)');
    case SamplingInnerName.EVENT_DEVICE_FAMILY:
      return t('ex. Mac, Pixel*');
    case SamplingInnerName.EVENT_DEVICE_NAME:
      return t('ex. Mac, Pixel*');
    default:
      return t('tag values');
  }
}

export function getNewCondition(condition: Condition): SamplingConditionLogicalInner {
  // SamplingConditionLogicalInnerEqBoolean
  if (
    condition.category === SamplingInnerName.EVENT_BROWSER_EXTENSIONS ||
    condition.category === SamplingInnerName.EVENT_WEB_CRAWLERS ||
    condition.category === SamplingInnerName.EVENT_LOCALHOST
  ) {
    return {
      op: SamplingInnerOperator.EQUAL,
      name: condition.category,
      value: true,
    };
  }

  // SamplingConditionLogicalInnerCustom
  if (condition.category === SamplingInnerName.EVENT_LEGACY_BROWSER) {
    return {
      op: SamplingInnerOperator.CUSTOM,
      name: condition.category,
      value: condition.legacyBrowsers ?? [],
    };
  }

  const newValue = (condition.match ?? '')
    .split('\n')
    .filter(match => !!match.trim())
    .map(match => match.trim());

  if (
    condition.category === SamplingInnerName.EVENT_IP_ADDRESSES ||
    condition.category === SamplingInnerName.EVENT_CSP
  ) {
    return {
      op: SamplingInnerOperator.CUSTOM,
      name: condition.category,
      value: newValue,
    };
  }

  // SamplingConditionLogicalInnerGlob
  if (
    condition.category === SamplingInnerName.EVENT_RELEASE ||
    condition.category === SamplingInnerName.TRACE_RELEASE ||
    condition.category === SamplingInnerName.EVENT_TRANSACTION ||
    condition.category === SamplingInnerName.TRACE_TRANSACTION ||
    condition.category === SamplingInnerName.EVENT_OS_NAME ||
    condition.category === SamplingInnerName.EVENT_OS_VERSION ||
    condition.category === SamplingInnerName.EVENT_DEVICE_FAMILY ||
    condition.category === SamplingInnerName.EVENT_DEVICE_NAME ||
    isCustomTagName(condition.category)
  ) {
    return {
      op: SamplingInnerOperator.GLOB_MATCH,
      name: condition.category,
      value: newValue,
    };
  }

  // SamplingConditionLogicalInnerEq
  if (
    condition.category === SamplingInnerName.TRACE_USER_ID ||
    condition.category === SamplingInnerName.EVENT_USER_ID
  ) {
    return {
      op: SamplingInnerOperator.EQUAL,
      name: condition.category,
      value: newValue,
      options: {
        ignoreCase: false,
      },
    };
  }

  // SamplingConditionLogicalInnerEq
  return {
    op: SamplingInnerOperator.EQUAL,
    // TODO(sampling): remove the cast
    name: condition.category as
      | SamplingInnerName.TRACE_ENVIRONMENT
      | SamplingInnerName.TRACE_USER_ID
      | SamplingInnerName.TRACE_USER_SEGMENT
      | SamplingInnerName.EVENT_ENVIRONMENT
      | SamplingInnerName.EVENT_USER_ID
      | SamplingInnerName.EVENT_USER_SEGMENT,
    value: newValue,
    options: {
      ignoreCase: true,
    },
  };
}

const unexpectedErrorMessage = t('An internal error occurred while saving sampling rule');

type ResponseJSONDetailed = {
  detail: string[];
};

type ResponseJSON = {
  dynamicSampling?: {
    rules: Array<Partial<SamplingRule>>;
  };
};

export function getErrorMessage(
  error: {
    responseJSON?: ResponseJSON | ResponseJSONDetailed;
  },
  currentRuleIndex: number
) {
  const detailedErrorResponse = (error.responseJSON as undefined | ResponseJSONDetailed)
    ?.detail;

  if (detailedErrorResponse) {
    // This is a temp solution until we enable error rules again, therefore it does not need translation
    return detailedErrorResponse[0];
  }

  const errorResponse = error.responseJSON as undefined | ResponseJSON;

  if (!errorResponse) {
    return unexpectedErrorMessage;
  }

  const responseErrors = errorResponse.dynamicSampling?.rules[currentRuleIndex] ?? {};

  const [type, _value] = Object.entries(responseErrors)[0];

  if (type === 'sampleRate') {
    return {
      type: 'sampleRate',
      message: t('Ensure this value is a floating number between 0 and 100'),
    };
  }

  return unexpectedErrorMessage;
}

export function getTagKey(condition: Condition) {
  switch (condition.category) {
    case SamplingInnerName.TRACE_RELEASE:
    case SamplingInnerName.EVENT_RELEASE:
      return 'release';
    case SamplingInnerName.TRACE_ENVIRONMENT:
    case SamplingInnerName.EVENT_ENVIRONMENT:
      return 'environment';
    case SamplingInnerName.TRACE_TRANSACTION:
    case SamplingInnerName.EVENT_TRANSACTION:
      return 'transaction';
    case SamplingInnerName.EVENT_OS_NAME:
      return 'os.name';
    case SamplingInnerName.EVENT_OS_VERSION:
      return 'os.version';
    case SamplingInnerName.EVENT_DEVICE_FAMILY:
      return 'device.family';
    case SamplingInnerName.EVENT_DEVICE_NAME:
      return 'device.name';
    case SamplingInnerName.EVENT_CUSTOM_TAG:
      return '';
    default:
      // custom tags
      return stripCustomTagPrefix(condition.category);
  }
}

export const distributedTracesConditions = [
  SamplingInnerName.TRACE_RELEASE,
  SamplingInnerName.TRACE_ENVIRONMENT,
  SamplingInnerName.TRACE_USER_ID,
  SamplingInnerName.TRACE_USER_SEGMENT,
  SamplingInnerName.TRACE_TRANSACTION,
];

export const individualTransactionsConditions = [
  SamplingInnerName.EVENT_RELEASE,
  SamplingInnerName.EVENT_ENVIRONMENT,
  SamplingInnerName.EVENT_USER_ID,
  SamplingInnerName.EVENT_USER_SEGMENT,
  SamplingInnerName.EVENT_BROWSER_EXTENSIONS,
  SamplingInnerName.EVENT_LOCALHOST,
  SamplingInnerName.EVENT_LEGACY_BROWSER,
  SamplingInnerName.EVENT_WEB_CRAWLERS,
  SamplingInnerName.EVENT_IP_ADDRESSES,
  SamplingInnerName.EVENT_CSP,
  SamplingInnerName.EVENT_TRANSACTION,
  SamplingInnerName.EVENT_OS_NAME,
  SamplingInnerName.EVENT_OS_VERSION,
  SamplingInnerName.EVENT_DEVICE_FAMILY,
  SamplingInnerName.EVENT_DEVICE_NAME,
  SamplingInnerName.EVENT_CUSTOM_TAG,
];

export function generateConditionCategoriesOptions(
  conditionCategories: SamplingInnerName[]
): [SamplingInnerName, string][] {
  const hasCustomTagCategory = conditionCategories.includes(
    SamplingInnerName.EVENT_CUSTOM_TAG
  );

  const sortedConditionCategories = conditionCategories
    // filter our custom tag category, we will append it to the bottom
    .filter(category => category !== SamplingInnerName.EVENT_CUSTOM_TAG)
    // sort dropdown options alphabetically based on display labels
    .sort((a, b) => getInnerNameLabel(a).localeCompare(getInnerNameLabel(b)));

  if (hasCustomTagCategory) {
    sortedConditionCategories.push(SamplingInnerName.EVENT_CUSTOM_TAG);
  }

  // massage into format that select component understands
  return sortedConditionCategories.map(innerName => [
    innerName,
    getInnerNameLabel(innerName),
  ]);
}

export function formatCreateTagLabel(label: string) {
  return tct('Add "[newLabel]"', {
    newLabel: <TruncatedLabel value={label} />,
  });
}
