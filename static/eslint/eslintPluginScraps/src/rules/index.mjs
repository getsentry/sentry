import {noCoreImport} from './no-core-import.mjs';
import {noTokenImport} from './no-token-import.mjs';
import {restrictJsxSlotChildren} from './restrict-jsx-slot-children.mjs';
import {useSemanticToken} from './use-semantic-token.mjs';

export const rules = {
  'no-core-import': noCoreImport,
  'no-token-import': noTokenImport,
  'restrict-jsx-slot-children': restrictJsxSlotChildren,
  'use-semantic-token': useSemanticToken,
};
