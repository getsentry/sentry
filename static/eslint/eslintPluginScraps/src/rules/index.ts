import {noCoreImport} from './no-core-import';
import {noTokenImport} from './no-token-import';
import {noZIndex} from './no-z-index';
import {preferInfoText} from './prefer-info-text';
import {restrictJsxSlotChildren} from './restrict-jsx-slot-children';
import {useSemanticToken} from './use-semantic-token';

export const rules = {
  'no-core-import': noCoreImport,
  'no-token-import': noTokenImport,
  'no-z-index': noZIndex,
  'prefer-info-text': preferInfoText,
  'restrict-jsx-slot-children': restrictJsxSlotChildren,
  'use-semantic-token': useSemanticToken,
};
