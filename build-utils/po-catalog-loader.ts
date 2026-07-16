import type {LoaderDefinition} from '@rspack/core';
import {po} from 'gettext-parser';

// PO references are whitespace-delimited `path:line` values from JS and TS modules.
const FRONTEND_REFERENCE = /(?:^|\s)[^\s:]+\.[jt]sx?:/;

type CatalogMetadata = {
  domain: string;
  lang: string;
  plural_forms: string;
};

type CompiledPoCatalog = Record<string, string[] | CatalogMetadata>;

const poCatalogLoader: LoaderDefinition = function (source) {
  const catalog = po.parse(source);
  const messages = catalog.translations[''];
  const output: CompiledPoCatalog = Object.create(null);

  for (const messageId in messages) {
    if (!messageId) {
      continue;
    }

    const message = messages[messageId];
    const reference = message.comments?.reference;
    if (!reference || !FRONTEND_REFERENCE.test(reference)) {
      continue;
    }

    if (message.msgstr.includes('')) {
      continue;
    }

    output[messageId] = message.msgstr;
  }

  const lang = catalog.headers.Language;
  const pluralForms = catalog.headers['Plural-Forms'];
  if (!lang || !pluralForms) {
    throw new Error(`Missing locale headers in ${this.resourcePath}`);
  }

  output[''] = {
    domain: 'sentry',
    lang,
    plural_forms: pluralForms,
  };

  return `module.exports=${JSON.stringify(output)}`;
};

export default poCatalogLoader;
