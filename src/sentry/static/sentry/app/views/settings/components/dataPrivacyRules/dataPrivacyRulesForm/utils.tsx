import {t} from 'app/locale';

import {RuleType, MethodType} from './types';

function getRuleTypeLabel(labelType: RuleType) {
  switch (labelType) {
    case RuleType.ANYTHING:
      return {
        label: t('Anything'),
      };
    case RuleType.IMEI:
      return {
        label: t('IMEI numbers'),
      };
    case RuleType.MAC:
      return {
        label: t('MAC addresses'),
        description: t('xx:xx:xx:xx:xx:xx'),
      };
    case RuleType.EMAIL:
      return {
        label: t('Email addresses'),
        description: t('user@example.com'),
      };
    case RuleType.PEMKEY:
      return {
        label: t('PEM keys'),
        description: t('BAsME0RvY3Vtl...'),
      };
    case RuleType.URLAUTH:
      return {
        label: t('Auth in URLs'),
        description: t('/v1/users/1?access_token=*'),
      };
    case RuleType.USSSN:
      return {
        label: t('US social security numbers'),
        description: t('xxx-xx-xxxx'),
      };
    case RuleType.USER_PATH:
      return {
        label: t('Usernames in filepaths'),
        description: t('/Users/username/*'),
      };
    case RuleType.UUID:
      return {
        label: t('UUIDs'),
        description: t('xxxxxxxx-xxxx-Mxxx...'),
      };
    case RuleType.CREDITCARD:
      return {
        label: t('Credit card numbers'),
        description: 'xxxx xxxx xxxx xxxx',
      };
    case RuleType.PASSWORD:
      return {
        label: t('Password fields'),
        description: t('xxxxxxxx'),
      };
    case RuleType.IP:
      return {
        label: t('IP addresses'),
        description: t('127.0.0.1'),
      };
    case RuleType.PATTERN:
      return {
        label: t('Regex matches'),
        description: t('[a-zA-Z0-9]+'),
      };
    default:
      return {
        label: '',
      };
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
