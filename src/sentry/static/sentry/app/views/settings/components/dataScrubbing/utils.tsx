import {t} from 'app/locale';

import {RuleType, MethodType, SourceSuggestionType, SourceSuggestion} from './types';

function getRuleLabel(type: RuleType) {
  switch (type) {
    case RuleType.ANYTHING:
      return t('Anything');
    case RuleType.IMEI:
      return t('IMEI numbers');
    case RuleType.MAC:
      return t('MAC addresses');
    case RuleType.EMAIL:
      return t('Email addresses');
    case RuleType.PEMKEY:
      return t('PEM keys');
    case RuleType.URLAUTH:
      return t('Auth in URLs');
    case RuleType.USSSN:
      return t('US social security numbers');
    case RuleType.USER_PATH:
      return t('Usernames in filepaths');
    case RuleType.UUID:
      return t('UUIDs');
    case RuleType.CREDITCARD:
      return t('Credit card numbers');
    case RuleType.PASSWORD:
      return t('Password fields');
    case RuleType.IP:
      return t('IP addresses');
    case RuleType.PATTERN:
      return t('Regex matches');
    default:
      return '';
  }
}

function getMethodLabel(type: MethodType) {
  switch (type) {
    case MethodType.MASK:
      return {
        label: t('Mask'),
        description: t('Replace with ****'),
      };
    case MethodType.HASH:
      return {
        label: t('Hash'),
        description: t('Replace with DEADBEEF'),
      };
    case MethodType.REMOVE:
      return {
        label: t('Remove'),
        description: t('Replace with null'),
      };
    case MethodType.REPLACE:
      return {
        label: t('Replace'),
        description: t('Replace with Placeholder'),
      };
    default:
      return {
        label: '',
      };
  }
}

const binarySuggestions: Array<SourceSuggestion> = [
  {
    type: SourceSuggestionType.BINARY,
    value: '&&',
  },
  {
    type: SourceSuggestionType.BINARY,
    value: '||',
  },
];

const unarySuggestions: Array<SourceSuggestion> = [
  {
    type: SourceSuggestionType.UNARY,
    value: '!',
  },
];

const valueSuggestions: Array<SourceSuggestion> = [
  {type: SourceSuggestionType.VALUE, value: '**', description: t('everywhere')},
  {
    type: SourceSuggestionType.VALUE,
    value: 'password',
    description: t('attributes named "password"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$error.value',
    description: t('the exception value'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$message',
    description: t('the log message'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'extra.MyValue',
    description: t('the key "MyValue" in "Additional Data"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'extra.**',
    description: t('everything in "Additional Data"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$http.headers.x-custom-token',
    description: t('the X-Custom-Token HTTP header'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$user.ip_address',
    description: t('the user IP address'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$frame.vars.foo',
    description: t('the local variable "foo"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'contexts.device.timezone',
    description: t('the timezone in the device context'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'tags.server_name',
    description: t('the tag "server_name"'),
  },
];

export {
  getRuleLabel,
  getMethodLabel,
  unarySuggestions,
  binarySuggestions,
  valueSuggestions,
};
