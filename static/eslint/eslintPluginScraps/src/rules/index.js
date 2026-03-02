import {noCoreImport} from './no-core-import.js';
import {noTokenImport} from './no-token-import.js';
import {restrictJsxSlotChildren} from './restrict-jsx-slot-children.js';
import {useSemanticToken} from './use-semantic-token.js';

export const rules = {
  'no-core-import': noCoreImport,
  'no-token-import': noTokenImport,
  'restrict-jsx-slot-children': restrictJsxSlotChildren,
  'use-semantic-token': useSemanticToken,
};
