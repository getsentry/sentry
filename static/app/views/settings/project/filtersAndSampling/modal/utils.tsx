import {css} from '@emotion/react';

import {t, tct} from 'sentry/locale';
import {
  DynamicSamplingConditionLogicalInner,
  DynamicSamplingInnerName,
  DynamicSamplingInnerOperator,
  DynamicSamplingRule,
  LegacyBrowser,
} from 'sentry/types/dynamicSampling';
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

  @media (min-width: ${theme.breakpoints[0]}) {
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

export function getMatchFieldPlaceholder(category: DynamicSamplingInnerName | string) {
  switch (category) {
    case DynamicSamplingInnerName.EVENT_LEGACY_BROWSER:
      return t('Match all selected legacy browsers below');
    case DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS:
      return t('Match all browser extensions');
    case DynamicSamplingInnerName.EVENT_LOCALHOST:
      return t('Match all localhosts');
    case DynamicSamplingInnerName.EVENT_WEB_CRAWLERS:
      return t('Match all web crawlers');
    case DynamicSamplingInnerName.EVENT_USER_ID:
    case DynamicSamplingInnerName.TRACE_USER_ID:
      return t('ex. 4711 (Multiline)');
    case DynamicSamplingInnerName.EVENT_USER_SEGMENT:
    case DynamicSamplingInnerName.TRACE_USER_SEGMENT:
      return t('ex. paid, common (Multiline)');
    case DynamicSamplingInnerName.TRACE_ENVIRONMENT:
    case DynamicSamplingInnerName.EVENT_ENVIRONMENT:
      return t('ex. prod, dev');
    case DynamicSamplingInnerName.TRACE_RELEASE:
    case DynamicSamplingInnerName.EVENT_RELEASE:
      return t('ex. 1*, [I3].[0-9].*');
    case DynamicSamplingInnerName.EVENT_IP_ADDRESSES:
      return t('ex. 127.0.0.1 or 10.0.0.0/8 (Multiline)');
    case DynamicSamplingInnerName.EVENT_CSP:
      return t('ex. file://*, example.com (Multiline)');
    case DynamicSamplingInnerName.EVENT_ERROR_MESSAGES:
      return t('ex. TypeError* (Multiline)');
    case DynamicSamplingInnerName.TRACE_TRANSACTION:
    case DynamicSamplingInnerName.EVENT_TRANSACTION:
      return t('ex. page-load');
    case DynamicSamplingInnerName.EVENT_OS_NAME:
      return t('ex. Mac OS X, Windows');
    case DynamicSamplingInnerName.EVENT_OS_VERSION:
      return t('ex. 11, 9* (Multiline)');
    case DynamicSamplingInnerName.EVENT_DEVICE_FAMILY:
      return t('ex. Mac, Pixel*');
    case DynamicSamplingInnerName.EVENT_DEVICE_NAME:
      return t('ex. Mac, Pixel*');
    default:
      return t('tag values');
  }
}

export function getNewCondition(
  condition: Condition
): DynamicSamplingConditionLogicalInner {
  // DynamicSamplingConditionLogicalInnerEqBoolean
  if (
    condition.category === DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS ||
    condition.category === DynamicSamplingInnerName.EVENT_WEB_CRAWLERS ||
    condition.category === DynamicSamplingInnerName.EVENT_LOCALHOST
  ) {
    return {
      op: DynamicSamplingInnerOperator.EQUAL,
      name: condition.category,
      value: true,
    };
  }

  // DynamicSamplingConditionLogicalInnerCustom
  if (condition.category === DynamicSamplingInnerName.EVENT_LEGACY_BROWSER) {
    return {
      op: DynamicSamplingInnerOperator.CUSTOM,
      name: condition.category,
      value: condition.legacyBrowsers ?? [],
    };
  }

  const newValue = (condition.match ?? '')
    .split('\n')
    .filter(match => !!match.trim())
    .map(match => match.trim());

  if (
    condition.category === DynamicSamplingInnerName.EVENT_IP_ADDRESSES ||
    condition.category === DynamicSamplingInnerName.EVENT_ERROR_MESSAGES ||
    condition.category === DynamicSamplingInnerName.EVENT_CSP
  ) {
    return {
      op: DynamicSamplingInnerOperator.CUSTOM,
      name: condition.category,
      value: newValue,
    };
  }

  // DynamicSamplingConditionLogicalInnerGlob
  if (
    condition.category === DynamicSamplingInnerName.EVENT_RELEASE ||
    condition.category === DynamicSamplingInnerName.TRACE_RELEASE ||
    condition.category === DynamicSamplingInnerName.EVENT_TRANSACTION ||
    condition.category === DynamicSamplingInnerName.TRACE_TRANSACTION ||
    condition.category === DynamicSamplingInnerName.EVENT_OS_NAME ||
    condition.category === DynamicSamplingInnerName.EVENT_OS_VERSION ||
    condition.category === DynamicSamplingInnerName.EVENT_DEVICE_FAMILY ||
    condition.category === DynamicSamplingInnerName.EVENT_DEVICE_NAME ||
    isCustomTagName(condition.category)
  ) {
    return {
      op: DynamicSamplingInnerOperator.GLOB_MATCH,
      name: condition.category,
      value: newValue,
    };
  }

  // DynamicSamplingConditionLogicalInnerEq
  if (
    condition.category === DynamicSamplingInnerName.TRACE_USER_ID ||
    condition.category === DynamicSamplingInnerName.EVENT_USER_ID
  ) {
    return {
      op: DynamicSamplingInnerOperator.EQUAL,
      name: condition.category,
      value: newValue,
      options: {
        ignoreCase: false,
      },
    };
  }

  // DynamicSamplingConditionLogicalInnerEq
  return {
    op: DynamicSamplingInnerOperator.EQUAL,
    // TODO(sampling): remove the cast
    name: condition.category as
      | DynamicSamplingInnerName.TRACE_ENVIRONMENT
      | DynamicSamplingInnerName.TRACE_USER_ID
      | DynamicSamplingInnerName.TRACE_USER_SEGMENT
      | DynamicSamplingInnerName.EVENT_ENVIRONMENT
      | DynamicSamplingInnerName.EVENT_USER_ID
      | DynamicSamplingInnerName.EVENT_USER_SEGMENT,
    value: newValue,
    options: {
      ignoreCase: true,
    },
  };
}

const unexpectedErrorMessage = t(
  'An internal error occurred while saving dynamic sampling rule'
);

type ResponseJSONDetailed = {
  detail: string[];
};

type ResponseJSON = {
  dynamicSampling?: {
    rules: Array<Partial<DynamicSamplingRule>>;
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
    case DynamicSamplingInnerName.TRACE_RELEASE:
    case DynamicSamplingInnerName.EVENT_RELEASE:
      return 'release';
    case DynamicSamplingInnerName.TRACE_ENVIRONMENT:
    case DynamicSamplingInnerName.EVENT_ENVIRONMENT:
      return 'environment';
    case DynamicSamplingInnerName.TRACE_TRANSACTION:
    case DynamicSamplingInnerName.EVENT_TRANSACTION:
      return 'transaction';
    case DynamicSamplingInnerName.EVENT_OS_NAME:
      return 'os.name';
    case DynamicSamplingInnerName.EVENT_OS_VERSION:
      return 'os.version';
    case DynamicSamplingInnerName.EVENT_DEVICE_FAMILY:
      return 'device.family';
    case DynamicSamplingInnerName.EVENT_DEVICE_NAME:
      return 'device.name';
    case DynamicSamplingInnerName.EVENT_CUSTOM_TAG:
      return '';
    default:
      // custom tags
      return stripCustomTagPrefix(condition.category);
  }
}

export function generateConditionCategoriesOptions(
  conditionCategories: DynamicSamplingInnerName[]
): [DynamicSamplingInnerName, string][] {
  const hasCustomTagCategory = conditionCategories.includes(
    DynamicSamplingInnerName.EVENT_CUSTOM_TAG
  );

  const sortedConditionCategories = conditionCategories
    // filter our custom tag category, we will append it to the bottom
    .filter(category => category !== DynamicSamplingInnerName.EVENT_CUSTOM_TAG)
    // sort dropdown options alphabetically based on display labels
    .sort((a, b) => getInnerNameLabel(a).localeCompare(getInnerNameLabel(b)));

  if (hasCustomTagCategory) {
    sortedConditionCategories.push(DynamicSamplingInnerName.EVENT_CUSTOM_TAG);
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
