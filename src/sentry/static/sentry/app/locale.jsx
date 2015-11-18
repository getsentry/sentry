import Jed from 'jed';

const i18n = new Jed({
  'domain' : 'sentry',

  // This callback is called when a key is missing
  'missing_key_callback' : function(key) {
    // TODO(dcramer): this should log to Sentry
  },

  'locale_data' : {
    // This is the domain key
    'sentry' : {
      // The empty string key is used as the configuration
      // block for each domain
      '' : {
        // Domain name
        'domain' : 'sentry',

        // Language code
        'lang' : 'en',

        // Plural form function for language
        'plural_forms' : 'nplurals=2; plural=(n != 1);'
      },
    }
  }
});

export const gettext = i18n.gettext.bind(i18n);
export const ngettext = i18n.ngettext.bind(i18n);
export const t = i18n.gettext.bind(i18n);
export const tn = i18n.ngettext.bind(i18n);
export default i18n;
