import {t} from 'app/locale';

import {RuleType, MethodType} from '../types';

function getRuleTypeLabel(type: RuleType) {
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

function getMethodTypeLabel(type: MethodType) {
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
        description: t('Replace with [Filtered]'),
      };
    default:
      return {
        label: '',
      };
  }
}

export {getRuleTypeLabel, getMethodTypeLabel};
