import {po} from 'gettext-parser';
import loaderUtils from 'loader-utils';

function isEmptyMessage(msg: any): boolean {
  return msg.msgstr.some((str: string | null) => str === '' || str === null);
}

function messageIsExcluded(msg: any, extensions: string[] | undefined): boolean {
  if (!extensions) {
    return false;
  }

  const references = (msg.comments?.reference ?? '<unknown>').split(/\n/);

  for (const reference of references) {
    const filename = reference.split(/:/)[0];
    if (extensions.some(ext => filename.endsWith(ext))) {
      return false;
    }
  }

  return true;
}

export default function (this: any, source: string) {
  const options = loaderUtils.getOptions(this);
  const catalog = po.parse(source, {defaultCharset: 'UTF-8'});

  this.cacheable();

  const rv: Record<string, any> = {};
  for (const msgid in catalog.translations['']) {
    if (msgid === '') {
      continue;
    }
    const msg = catalog.translations[''][msgid];
    if (!isEmptyMessage(msg) && !messageIsExcluded(msg, options.referenceExtensions)) {
      rv[msgid] = msg.msgstr;
    }
  }

  rv[''] = {
    domain: options.domain ?? 'messages',
    plural_forms: catalog.headers['plural-forms'],
    lang: catalog.headers['language'],
  };

  if (options.raw) {
    return rv;
  }

  return `module.exports = ${JSON.stringify(rv)};`;
}
