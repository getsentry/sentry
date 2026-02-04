import {noCoreImport} from './no-core-import.mjs';
import {noTokenImport} from './no-token-import.mjs';
import {useSemanticToken} from './use-semantic-token.mjs';

export const rules = {
  'no-core-import': noCoreImport,
  'no-token-import': noTokenImport,
  'use-semantic-token': useSemanticToken,
};
