import {platforms} from 'integration-docs-platforms';
import {t} from 'app/locale';

const otherPlatform = {
  integrations: [
    {
      link: 'https://docs.getsentry.com/hosted/clients/',
      type: 'language',
      id: 'other',
      name: t('Other'),
    },
  ],
  id: 'other',
  name: t('Other'),
};

export default [].concat(
  [],
  ...[...platforms, otherPlatform].map(platform =>
    platform.integrations.map(i => ({...i, language: platform.id}))
  )
);
