import {t} from 'app/locale';

export type DataType = 'creditcard' | 'iban' | 'password' | 'ip' | 'pattern';
const ALL_DATA_TYPES: DataType[] = ['creditcard', 'iban', 'password', 'ip', 'pattern'];

export type ActionType = 'mask' | 'remove' | 'hash' | 'replace';
const ALL_ACTION_TYPES: ActionType[] = ['mask', 'remove', 'hash', 'replace'];

function getDataSelectorFieldLabel(labelType: DataType): string {
  switch (labelType) {
    case 'creditcard':
      return t('Credit Card Number');
    case 'iban':
      return t('IBAN bank accounts');
    case 'password':
      return t('Passwords');
    case 'ip':
      return t('IP Addresses');
    case 'pattern':
      return t('Custom Regular Expression');
    default:
      return labelType;
  }
}

function getActionTypeSelectorFieldLabel(labelType: ActionType): string {
  switch (labelType) {
    case 'mask':
      return t('Mask');
    case 'hash':
      return t('Hash');
    case 'remove':
      return t('Remove');
    case 'replace':
      return t('Replace');
    default:
      return labelType;
  }
}

export {
  ALL_DATA_TYPES,
  getDataSelectorFieldLabel,
  ALL_ACTION_TYPES,
  getActionTypeSelectorFieldLabel,
};
