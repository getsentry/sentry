import {noCoreImport} from './noCoreImport.ts';
import {noDirectResponsiveQueries} from './noDirectResponsiveQueries.ts';
import {noDoubleDollarInterpolation} from './noDoubleDollarInterpolation.ts';
import {noRestrictedModuleMocks} from './noRestrictedModuleMocks.ts';
import {noTokenImport} from './noTokenImport.ts';
import {preferInfoText} from './preferInfoText.ts';
import {preferPrimitives} from './preferPrimitives.ts';
import {preferStackForColumnFlex} from './preferStackForColumnFlex.ts';
import {requireRenderPropSpread} from './requireRenderPropSpread.ts';
import {restrictJsxSlotChildren} from './restrictJsxSlotChildren.ts';
import {useSemanticToken} from './useSemanticToken.ts';

export const rules = {
  'no-core-import': noCoreImport,
  'no-double-dollar-interpolation': noDoubleDollarInterpolation,
  'no-restricted-module-mocks': noRestrictedModuleMocks,
  'no-token-import': noTokenImport,
  'no-direct-responsive-queries': noDirectResponsiveQueries,
  'prefer-info-text': preferInfoText,
  'prefer-primitives': preferPrimitives,
  'prefer-stack-for-column-flex': preferStackForColumnFlex,
  'require-render-prop-spread': requireRenderPropSpread,
  'restrict-jsx-slot-children': restrictJsxSlotChildren,
  'use-semantic-token': useSemanticToken,
};
