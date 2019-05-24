import {t} from 'app/locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/debug-symbols/';

export const fields = {
  builtinSymbolSources: {
    name: 'builtinSymbolSources',
    type: 'select',
    multiple: true,
    label: t('Built-in Repositories'),
    help: t(
      'Configures which built-in repositories Sentry should use to resolve debug files.'
    ),
    choices: [
      ['microsoft', t('Microsoft')],
      ['amd', t('AMD')],
      ['autodesk', t('Autodesk')],
      ['chromium', t('Chromium')],
      ['citrix', t('Citrix')],
      ['intel', t('Intel')],
      ['mozilla', t('Mozilla')],
      ['nvidia', t('NVIDIA')],
      ['unity', t('Unity')],
    ],
  },
  symbolSources: {
    name: 'symbolSources',
    type: 'string',
    label: t('Custom Repositories'),
    placeholder: t('Paste JSON here.'),
    multiline: true,
    monospace: true,
    autosize: true,
    inline: false,
    maxRows: 10,
    saveOnBlur: false,
    saveMessageAlertType: 'info',
    saveMessage: t('Updates will apply to future events only.'),
    formatMessageValue: false,
    help: t(
      'Configures custom repositories containing debug files. At the moment, only Amazon S3 buckets are supported.'
    ),
    validate: ({id, form}) => {
      try {
        if (form[id].trim()) {
          JSON.parse(form[id]);
        }
      } catch (e) {
        return [[id, e.toString().replace(/^SyntaxError: JSON.parse: /, '')]];
      }
      return [];
    },
  },
};
