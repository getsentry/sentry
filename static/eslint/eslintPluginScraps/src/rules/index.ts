import {noCoreImport} from './no-core-import';
import {noDoubleDollarInterpolation} from './no-double-dollar-interpolation';
import {noTokenImport} from './no-token-import';
import {preferInfoText} from './prefer-info-text';
import {preferStackForColumnFlex} from './prefer-stack-for-column-flex';
import {restrictJsxSlotChildren} from './restrict-jsx-slot-children';
import {useSemanticToken} from './use-semantic-token';

export const rules = {
  'no-core-import': noCoreImport,
  'no-double-dollar-interpolation': noDoubleDollarInterpolation,
  'no-token-import': noTokenImport,
  'prefer-info-text': preferInfoText,
  'prefer-stack-for-column-flex': preferStackForColumnFlex,
  'restrict-jsx-slot-children': restrictJsxSlotChildren,
  'use-semantic-token': useSemanticToken,
};
