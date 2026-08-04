import {noCoreImport} from './noCoreImport';
import {noDoubleDollarInterpolation} from './noDoubleDollarInterpolation';
import {noTokenImport} from './noTokenImport';
import {preferInfoText} from './preferInfoText';
import {preferStackForColumnFlex} from './preferStackForColumnFlex';
import {restrictJsxSlotChildren} from './restrictJsxSlotChildren';
import {useSemanticToken} from './useSemanticToken';

export const rules = {
  'no-core-import': noCoreImport,
  'no-double-dollar-interpolation': noDoubleDollarInterpolation,
  'no-token-import': noTokenImport,
  'prefer-info-text': preferInfoText,
  'prefer-stack-for-column-flex': preferStackForColumnFlex,
  'restrict-jsx-slot-children': restrictJsxSlotChildren,
  'use-semantic-token': useSemanticToken,
};
