import * as namespaceImport from './defaultFunction';
import importedDefault from './defaultIdentifier';
import {a as importedA} from './importedDefault';
import {text as importedText} from './importedDefaultKinds';

export * from './defaultFunction';
export {default as renamedDefault} from './defaultArrow';
export {importedA, importedDefault, importedText, namespaceImport};
