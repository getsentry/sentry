import Jed from 'jed';
import React from 'react';
import ConfigStore from './stores/configStore';
import { getTranslations } from './translations';
import { sprintf } from 'sprintf-js';

export function getCurrentTranslations() {
  let user = ConfigStore.get('user');
  let lang = user && user.language || 'en';
  return getTranslations(lang);
}

const i18n = new Jed({
  'domain' : 'sentry',

  // This callback is called when a key is missing
  'missing_key_callback' : function(key) {
    // TODO(dcramer): this should log to Sentry
  },

  'locale_data': {
    // XXX: configure language here
    'sentry': getCurrentTranslations()
  }
});

function formatForReact(formatString, args) {
  var rv = [];
  var cursor = 0;

  // always re-parse, do not cache, because we change the match
  sprintf.parse(formatString).forEach((match, idx) => {
    if (typeof match === 'string') {
      rv.push(match);
    } else {
      let arg = null;
      if (match[2]) {
        arg = args[0][match[2][0]];
      } else if (match[1]) {
        arg = args[parseInt(match[1], 10) - 1];
      } else {
        arg = args[cursor++];
      }

      // this points to a react element!
      if (React.isValidElement(arg)) {
        rv.push(arg);
      // not a react element, fuck around with it so that sprintf.format
      // can format it for us.  We make sure match[2] is null so that we
      // do not go down the object path, and we set match[1] to the first
      // index and then pass an array with two items in.
      } else {
        match[2] = null;
        match[1] = 1;
        rv.push(sprintf.format([match], [null, arg]));
      }
    }
  });
  return rv;
}

function argsInvolveReact(args) {
  if (args.some(React.isValidElement)) {
    return true;
  }
  if (args.length == 1 && typeof args[0] === 'object') {
    return Object.keys(args[0]).some((key) => {
      return React.isValidElement(args[0][key]);
    });
  }
  return false;
}

export function parseComponentTemplate(string) {
  let rv = {};

  function process(startPos, group, inGroup) {
    let regex = /\[([^:]*):|\]/g;
    let match;
    let buf = [];
    let satisfied = false;

    let pos = regex.lastIndex = startPos;
    while ((match = regex.exec(string)) !== null) { // eslint-disable-line no-cond-assign
      let substr = string.substr(pos, match.index - pos);
      if (substr !== '') {
        buf.push(substr);
      }

      if (match[0] == ']') {
        if (inGroup) {
          satisfied = true;
          break;
        } else {
          pos = regex.lastIndex;
          continue;
        }
      }

      pos = regex.lastIndex = process(regex.lastIndex, match[1], true);
      buf.push({group: match[1]});
    }

    let endPos = regex.lastIndex;
    if (!satisfied) {
      let rest = string.substr(pos);
      if (rest) {
        buf.push(rest);
      }
      endPos = string.length;
    }

    rv[group] = buf;
    return endPos;
  }

  process(0, 'root', false);

  return rv;
}

export function renderComponentTemplate(template, components) {
  function renderGroup(group) {
    let children = [];

    (template[group] || []).forEach((item) => {
      if (typeof item === 'string') {
        children.push(item);
      } else {
        children.push(renderGroup(item.group));
      }
    });

    // in case we cannot find our component, we call back to an empty
    // span so that stuff shows up at least.
    return React.cloneElement(
      components[group] || <span></span>, {}, children);
  }

  return renderGroup('root');
}

export function format(formatString, args) {
  if (argsInvolveReact(args)) {
    return formatForReact(formatString, args);
  } else {
    return sprintf(formatString, ...args);
  }
}

export function gettext(string, ...args) {
  let rv = i18n.gettext(string);
  if (args.length > 0) {
    rv = format(rv, args);
  }
  return rv;
}

export function ngettext(singular, plural, ...args) {
  return format(i18n.ngettext(singular, plural, args[0] || 0), args);
}

/* special form of gettext where you can render nested react
   components in template strings.  Example:

      gettextComponentTemplate('Welcome. Click [link:here]', {
        root: <p/>,
        link: <a href="#" />
      });

   the root string is always called "root", the rest is prefixed
   with the name in the brackets */
export function gettextComponentTemplate(template, components) {
  let tmpl = parseComponentTemplate(gettext(template));
  return renderComponentTemplate(tmpl, components);
}

export const t = gettext;
export const tn = ngettext;
export const tct = gettextComponentTemplate;
