import {t} from 'app/locale';

enum RULE_TYPE {
  PATTERN = 'pattern',
  CREDITCARD = 'creditcard',
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
  REPLACE = 'replace',
}

function getRuleTypeSelectorFieldLabel(labelType: RULE_TYPE): string {
  switch (labelType) {
    case RULE_TYPE.ANYTHING:
      return t('Anything');
    case RULE_TYPE.IMEI:
      return t('IMEI numbers');
    case RULE_TYPE.MAC:
      return t('MAC addresses');
    case RULE_TYPE.EMAIL:
      return t('Email addresses');
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
      return t('Credit card numbers');
    case RULE_TYPE.PASSWORD:
      return t('Password fields');
    case RULE_TYPE.IP:
      return t('IP addresses');
    case RULE_TYPE.PATTERN:
      return t('Regex matches');
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
    case METHOD_TYPE.REPLACE:
      return t('Replace');
    default:
      return '';
  }
}
enum EVENT_ID_FIELD_STATUS {
  LOADING = 'loading',
  INVALID = 'invalid',
  NOT_FOUND = 'not_found',
  LOADED = 'loaded',
  ERROR = 'error',
}

export {
  RULE_TYPE,
  METHOD_TYPE,
  EVENT_ID_FIELD_STATUS,
  getRuleTypeSelectorFieldLabel,
  getMethodTypeSelectorFieldLabel,
};
