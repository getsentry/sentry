import type {LoaderDefinition} from '@rspack/core';
import {po} from 'gettext-parser';

// PO references are whitespace-delimited `path:line` values from JS and TS modules.
const FRONTEND_REFERENCE = /(?:^|\s)[^\s:]+\.[jt]sx?:/;

// Jed concatenates the translation context and msgid with this delimiter when
// looking up context-specific messages (see `Jed.context_delimiter`).
const CONTEXT_DELIMITER = '\u0004';

type CatalogMetadata = {
  domain: string;
  lang: string;
  plural_forms: string;
};

type CompiledPoCatalog = Record<string, string[] | CatalogMetadata>;

const poCatalogLoader: LoaderDefinition = function (source) {
  const catalog = po.parse(source);
  const output: CompiledPoCatalog = Object.create(null);

  for (const [msgctxt, messages] of Object.entries(catalog.translations)) {
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

      // Jed looks up context-specific messages as `msgctxt\u0004msgid`
      const key = msgctxt ? `${msgctxt}${CONTEXT_DELIMITER}${messageId}` : messageId;
      output[key] = message.msgstr;
    }
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
