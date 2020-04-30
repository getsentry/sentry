import {t} from 'app/locale';

import {RuleType, MethodType} from './types';

function getRuleTypeLabel(labelType: RuleType): string {
  switch (labelType) {
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

function getMethodTypeLabel(labelType: MethodType): string {
  switch (labelType) {
    case MethodType.MASK:
      return t('Mask');
    case MethodType.HASH:
      return t('Hash');
    case MethodType.REMOVE:
      return t('Remove');
    case MethodType.REPLACE:
      return t('Replace');
    default:
      return '';
  }
}

export {getRuleTypeLabel, getMethodTypeLabel};
