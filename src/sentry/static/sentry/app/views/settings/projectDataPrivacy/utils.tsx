import {t} from 'app/locale';

enum RULE_TYPE {
  PATTERN = 'pattern',
  CREDITCARD = 'creditcard',
  IBAN = 'iban',
  PASSWORD = 'password',
  IP = 'ip',
  IMEI = 'imei',
  EMAIL = 'email',
  UUID = 'uuid',
  PEMKEY = 'pemkey',
  URLAUTH = 'urlauth',
  USSSN = 'usssn',
  USER_PATH = 'userpath',
  MAC = 'mac',
  ANYTHING = 'anything',
}

enum METHOD_TYPE {
  MASK = 'mask',
  REMOVE = 'remove',
  HASH = 'hash',
  // TODO(Priscila): reactivate METHOD_TYPE.REPLACE
  // REPLACE = 'replace',
}

function getRuleTypeSelectorFieldLabel(labelType: RULE_TYPE): string {
  switch (labelType) {
    case RULE_TYPE.ANYTHING:
      return t('Anything');
    case RULE_TYPE.IMEI:
      return t('IMEI Numbers');
    case RULE_TYPE.MAC:
      return t('MAC addresses');
    case RULE_TYPE.EMAIL:
      return t('Email Addresses');
    case RULE_TYPE.PEMKEY:
      return t('PEM keys');
    case RULE_TYPE.URLAUTH:
      return t('Auth in URLs');
    case RULE_TYPE.USSSN:
      return t('US social security numbers');
    case RULE_TYPE.USER_PATH:
      return t('Usernames in filepaths');
    case RULE_TYPE.UUID:
      return t('UUIDs');
    case RULE_TYPE.CREDITCARD:
      return t('Credit Card Number');
    case RULE_TYPE.IBAN:
      return t('IBAN bank accounts');
    case RULE_TYPE.PASSWORD:
      return t('Password fields');
    case RULE_TYPE.IP:
      return t('IP Addresses');
    case RULE_TYPE.PATTERN:
      return t('Custom Regular Expression');
    default:
      return '';
  }
}

function getMethodTypeSelectorFieldLabel(labelType: METHOD_TYPE): string {
  switch (labelType) {
    case METHOD_TYPE.MASK:
      return t('Mask');
    case METHOD_TYPE.HASH:
      return t('Hash');
    case METHOD_TYPE.REMOVE:
      return t('Remove');
    // TODO(Priscila): reactivate METHOD_TYPE.REPLACE
    // case METHOD_TYPE.REPLACE:
    //   return t('Replace');
    default:
      return '';
  }
}

export {
  RULE_TYPE,
  METHOD_TYPE,
  getRuleTypeSelectorFieldLabel,
  getMethodTypeSelectorFieldLabel,
};
