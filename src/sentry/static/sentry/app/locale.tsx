import React from 'react';
import Jed from 'jed';
import {sprintf} from 'sprintf-js';
import isString from 'lodash/isString';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import {css} from '@emotion/core';

import {getTranslations} from 'app/translations';

const markerCss = css`
  background: #ff801790;
  outline: 2px solid #ff801790;
`;

const sessionStorage = window.sessionStorage;
const LOCALE_DEBUG = sessionStorage && sessionStorage.getItem('localeDebug') === '1';

export function setLocaleDebug(value: boolean) {
  sessionStorage.setItem('localeDebug', value ? '1' : '0');
  // eslint-disable-next-line no-console
  console.log(`Locale debug is: ${value ? 'on' : 'off'}. Reload page to apply changes!`);
}

export function toggleLocaleDebug() {
  const currentValue = sessionStorage.getItem('localeDebug');
  setLocaleDebug(currentValue !== '1');
  window.location.reload();
}

/**
 * Global Jed locale object loaded with translations via setLocale
 */
let i18n: any = null;

/**
 * Set the current application locale.
 *
 * NOTE: This MUST be called early in the application before calls to any
 * translation functions, as this mutates a singleton translation object used
 * to lookup translations at runtime.
 */
export function setLocale(locale: string) {
  const translations = getTranslations(locale);
  i18n = new Jed({
    domain: 'sentry',
    missing_key_callback: () => {},
    locale_data: {
      sentry: translations,
    },
  });
}

setLocale('en');

type FormatArg = ComponentMap | React.ReactNode;

/**
 * printf style string formatting which render as react nodes.
 */
function formatForReact(formatString: string, args: FormatArg[]) {
  const nodes: React.ReactNodeArray = [];
  let cursor = 0;

  // always re-parse, do not cache, because we change the match
  sprintf.parse(formatString).forEach((match: any, idx: number) => {
    if (isString(match)) {
      nodes.push(match);
      return;
    }

    let arg: FormatArg = null;

    if (match[2]) {
      arg = (args[0] as ComponentMap)[match[2][0]];
    } else if (match[1]) {
      arg = args[parseInt(match[1], 10) - 1];
    } else {
      arg = args[cursor++];
    }

    // this points to a react element!
    if (React.isValidElement(arg)) {
      nodes.push(React.cloneElement(arg, {key: idx}));
    } else {
      // not a react element, fuck around with it so that sprintf.format
      // can format it for us.  We make sure match[2] is null so that we
      // do not go down the object path, and we set match[1] to the first
      // index and then pass an array with two items in.
      match[2] = null;
      match[1] = 1;
      nodes.push(<span key={idx++}>{sprintf.format([match], [null, arg])}</span>);
    }
  });

  return nodes;
}

/**
 * Determine if any arguments include React elements.
 */
function argsInvolveReact(args: FormatArg[]) {
  if (args.some(React.isValidElement)) {
    return true;
  }

  if (args.length !== 1 || !isObject(args[0])) {
    return false;
  }

  const componentMap = args[0] as ComponentMap;

  return Object.keys(componentMap).some(key => React.isValidElement(componentMap[key]));
}

/**
 * Parse template strings will be parsed into an array of TemplateSubvalue's,
 * this represents either a portion of the string, or a object with the group
 * key indicating the group to lookup the group value in.
 */
type TemplateSubvalue = string | {group: string};

/**
 * ParsedTemplate is a mapping of group names to Template Subvalue arrays.
 */
type ParsedTemplate = {[group: string]: TemplateSubvalue[]};

/**
 * ComponentMap maps template group keys to react node instances.
 *
 * NOTE: template group keys that include additional sub values (e.g.
 * [groupName:this string is the sub value]) will override the mapped react
 * nodes children prop.
 *
 * In the above example the component map of {groupName: <strong>text</strong>}
 * will be translated to `<strong>this string is the sub value</strong>`.
 */
type ComponentMap = {[group: string]: React.ReactNode};

/**
 * Parses a template string into groups.
 *
 * The top level group will be keyed as `root`. All other group names will have
 * been extracted from the template string.
 */
export function parseComponentTemplate(template: string) {
  const parsed: ParsedTemplate = {};

  function process(startPos: number, group: string, inGroup: boolean) {
    const regex = /\[(.*?)(:|\])|\]/g;
    const buf: TemplateSubvalue[] = [];

    let satisfied = false;
    let match: ReturnType<typeof regex.exec>;

    let pos = (regex.lastIndex = startPos);

    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(template)) !== null) {
      const substr = template.substr(pos, match.index - pos);
      if (substr !== '') {
        buf.push(substr);
      }

      const [fullMatch, groupName, closeBraceOrValueSeparator] = match;

      if (fullMatch === ']') {
        if (inGroup) {
          satisfied = true;
          break;
        } else {
          pos = regex.lastIndex;
          continue;
        }
      }

      if (closeBraceOrValueSeparator === ']') {
        pos = regex.lastIndex;
      } else {
        pos = regex.lastIndex = process(regex.lastIndex, groupName, true);
      }
      buf.push({group: groupName});
    }

    let endPos = regex.lastIndex;
    if (!satisfied) {
      const rest = template.substr(pos);
      if (rest) {
        buf.push(rest);
      }
      endPos = template.length;
    }

    parsed[group] = buf;
    return endPos;
  }

  process(0, 'root', false);

  return parsed;
}

/**
 * Renders a parsed template into a React tree given a ComponentMap to use for
 * the parsed groups.
 */
export function renderTemplate(template: ParsedTemplate, components: ComponentMap) {
  let idx = 0;

  function renderGroup(groupKey: string) {
    const children: React.ReactNode[] = [];
    const group = template[groupKey] || [];

    for (const item of group) {
      if (isString(item)) {
        children.push(<span key={idx++}>{item}</span>);
      } else {
        children.push(renderGroup(item.group));
      }
    }

    // In case we cannot find our component, we call back to an empty
    // span so that stuff shows up at least.
    let reference = components[groupKey] ?? <span key={idx++} />;

    if (!React.isValidElement(reference)) {
      reference = <span key={idx++}>{reference}</span>;
    }

    const element = reference as React.ReactElement;

    return children.length === 0
      ? React.cloneElement(element, {key: idx++})
      : React.cloneElement(element, {key: idx++}, children);
  }

  return <React.Fragment>{renderGroup('root')}</React.Fragment>;
}

/**
 * mark is used to debug translations by visually marking translated strings.
 *
 * NOTE: This is a no-op and will return the node if LOCALE_DEBUG is not
 * currently enabled. See setLocaleDebug and toggleLocaleDebug.
 */
function mark<T>(node: T): T {
  if (!LOCALE_DEBUG) {
    return node;
  }

  // TODO(epurkhiser): Explain why we manually create a react node and assign
  // the toString function. This could likely also use better typing, but will
  // require some understanding of reacts internal types.
  const proxy: any = {
    $$typeof: Symbol.for('react.element'),
    type: 'span',
    key: null,
    ref: null,
    props: {
      className: markerCss,
      children: isArray(node) ? node : [node],
    },
    _owner: null,
    _store: {},
  };

  proxy.toString = () => '✅' + node + '✅';

  return proxy;
}

/**
 * sprintf style string formatting. Does not handle translations.
 *
 * See the sprintf-js library [0] for specifics on the argument
 * parameterization format.
 *
 * [0]: https://github.com/alexei/sprintf.js
 */
export function format(formatString: string, args: FormatArg[]) {
  if (argsInvolveReact(args)) {
    return formatForReact(formatString, args);
  }

  return sprintf(formatString, ...args) as string;
}

/**
 * Translates a string to the current locale.
 *
 * See the sprintf-js library [0] for specifics on the argument
 * parameterization format.
 *
 * [0]: https://github.com/alexei/sprintf.js
 */
export function gettext(string: string, ...args: FormatArg[]) {
  const val: string = i18n.gettext(string);

  if (args.length === 0) {
    return mark(val);
  }

  // XXX(ts): It IS possible to use gettext in such a way that it will return a
  // React.ReactNodeArray, however we currently rarely (if at all) use it in
  // this way, and usually just expect strings back.
  return mark(format(val, args) as string);
}

/**
 * Translates a singular and plural string to the current locale. Supports
 * argument parameterization, and will use the first argument as the counter to
 * determine which message to use.
 *
 * See the sprintf-js library [0] for specifics on the argument
 * parameterization format.
 *
 * [0]: https://github.com/alexei/sprintf.js
 */
export function ngettext(singular: string, plural: string, ...args: FormatArg[]) {
  let countArg = 0;

  if (args.length > 0) {
    countArg = (args[0] as number) || 0;

    // `toLocaleString` will render `999` as `"999"` but `9999` as `"9,999"`. This means that any call with `tn` or `ngettext` cannot use `%d` in the codebase but has to use `%s`.
    // This means a string is always being passed in as an argument, but `sprintf-js` implicitly coerces strings that can be parsed as integers into an integer.
    // This would break under any locale that used different formatting and other undesirable behaviors.
    if ((singular + plural).includes('%d')) {
      // eslint-disable-next-line no-console
      console.error(new Error('You should not use %d within tn(), use %s instead'));
    } else {
      args = [countArg.toLocaleString(), ...args.slice(1)];
    }
  }

  // XXX(ts): See XXX in gettext.
  return mark(format(i18n.ngettext(singular, plural, countArg), args) as string);
}

/**
 * special form of gettext where you can render nested react components in
 * template strings.
 *
 * ```jsx
 * gettextComponentTemplate('Welcome. Click [link:here]', {
 *   root: <p/>,
 *   link: <a href="#" />,
 * });
 * ```
 *
 * The root string is always called "root", the rest is prefixed with the name
 * in the brackets
 *
 * You may recursively nest additional groups within the grouped string values.
 */
export function gettextComponentTemplate(template: string, components: ComponentMap) {
  const tmpl = parseComponentTemplate(i18n.gettext(template));
  return mark(renderTemplate(tmpl, components));
}

/**
 * Shorthand versions should primarily be used.
 */
export {gettext as t, ngettext as tn, gettextComponentTemplate as tct};
