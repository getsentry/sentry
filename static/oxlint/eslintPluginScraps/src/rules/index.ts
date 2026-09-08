import {noCoreImport} from './noCoreImport.ts';
import {noDoubleDollarInterpolation} from './noDoubleDollarInterpolation.ts';
import {noTokenImport} from './noTokenImport.ts';
import {preferInfoText} from './preferInfoText.ts';
import {preferStackForColumnFlex} from './preferStackForColumnFlex.ts';
import {restrictJsxSlotChildren} from './restrictJsxSlotChildren.ts';
import {useSemanticToken} from './useSemanticToken.ts';

export const rules = {
  'no-core-import': noCoreImport,
  'no-double-dollar-interpolation': noDoubleDollarInterpolation,
  'no-token-import': noTokenImport,
  'prefer-info-text': preferInfoText,
  'prefer-stack-for-column-flex': preferStackForColumnFlex,
  'restrict-jsx-slot-children': restrictJsxSlotChildren,
  'use-semantic-token': useSemanticToken,
};
