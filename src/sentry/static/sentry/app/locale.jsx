import Jed from 'jed';
import { getTranslations } from './translations';

const i18n = new Jed({
  'domain' : 'sentry',

  // This callback is called when a key is missing
  'missing_key_callback' : function(key) {
    // TODO(dcramer): this should log to Sentry
  },

  'locale_data': {
    // XXX: configure language here
    'sentry': getTranslations('en')
  }
});

export const gettext = i18n.gettext.bind(i18n);
export const ngettext = i18n.ngettext.bind(i18n);
export const t = i18n.gettext.bind(i18n);
export const tn = i18n.ngettext.bind(i18n);
export default i18n;
