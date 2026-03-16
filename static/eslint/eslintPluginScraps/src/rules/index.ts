import {noCoreImport} from './no-core-import';
import {noStyledCore} from './no-styled-core';
import {noTokenImport} from './no-token-import';
import {restrictJsxSlotChildren} from './restrict-jsx-slot-children';
import {useSemanticToken} from './use-semantic-token';

export const rules = {
  'no-core-import': noCoreImport,
  'no-styled-core': noStyledCore,
  'no-token-import': noTokenImport,
  'restrict-jsx-slot-children': restrictJsxSlotChildren,
  'use-semantic-token': useSemanticToken,
};
