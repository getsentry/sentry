import {noCoreImport} from './noCoreImport.ts';
import {noDoubleDollarInterpolation} from './noDoubleDollarInterpolation.ts';
import {noManualTable} from './noManualTable.ts';
import {noRestrictedModuleMocks} from './noRestrictedModuleMocks.ts';
import {noTokenImport} from './noTokenImport.ts';
import {preferInfoText} from './preferInfoText.ts';
import {preferPrimitives} from './preferPrimitives.ts';
import {preferStackForColumnFlex} from './preferStackForColumnFlex.ts';
import {requireFieldComponent} from './requireFieldComponent.ts';
import {requireRenderPropSpread} from './requireRenderPropSpread.ts';
import {restrictJsxSlotChildren} from './restrictJsxSlotChildren.ts';
import {useSemanticToken} from './useSemanticToken.ts';

export const rules = {
  'no-core-import': noCoreImport,
  'no-double-dollar-interpolation': noDoubleDollarInterpolation,
  'no-manual-table': noManualTable,
  'no-restricted-module-mocks': noRestrictedModuleMocks,
  'no-token-import': noTokenImport,
  'prefer-info-text': preferInfoText,
  'prefer-primitives': preferPrimitives,
  'prefer-stack-for-column-flex': preferStackForColumnFlex,
  'require-field-component': requireFieldComponent,
  'require-render-prop-spread': requireRenderPropSpread,
  'restrict-jsx-slot-children': restrictJsxSlotChildren,
  'use-semantic-token': useSemanticToken,
};
