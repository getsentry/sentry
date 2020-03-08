import {t} from 'app/locale';

enum DATA_TYPE {
  CREDIT_CARD_NUMBERS = 'credit_card_number',
  BANK_ACCOUNTS = 'bank_accounts',
  PASSWORD = 'passwords',
  PHONE_NUMBERS = 'phone_numbers',
  IP_ADDRESSES = 'ip_addresses',
  CUSTOM_REGULAR_EXPRESSION = 'custom_regular_expression',
}

enum ACTION_TYPE {
  MASK = 'mask',
  REMOVE = 'remove',
  HASH = 'hash',
  REPLACE = 'replace',
}

function getDataSelectorFieldLabel(labelType: DATA_TYPE): string {
  switch (labelType) {
    case DATA_TYPE.CREDIT_CARD_NUMBERS:
      return t('Credit Card Number');
    case DATA_TYPE.BANK_ACCOUNTS:
      return t('Bank accounts');
    case DATA_TYPE.PASSWORD:
      return t('Passwords');
    case DATA_TYPE.PHONE_NUMBERS:
      return t('Phone Numbers');
    case DATA_TYPE.IP_ADDRESSES:
      return t('IP Addresses');
    case DATA_TYPE.CUSTOM_REGULAR_EXPRESSION:
      return t('Custom Regular Expression');
    default:
      return '';
  }
}

function getActionTypeSelectorFieldLabel(labelType: ACTION_TYPE): string {
  switch (labelType) {
    case ACTION_TYPE.MASK:
      return t('Mask');
    case ACTION_TYPE.HASH:
      return t('Hash');
    case ACTION_TYPE.REMOVE:
      return t('Remove');
    case ACTION_TYPE.REPLACE:
      return t('Replace');
    default:
      return '';
  }
}

export {
  DATA_TYPE,
  getDataSelectorFieldLabel,
  ACTION_TYPE,
  getActionTypeSelectorFieldLabel,
};
