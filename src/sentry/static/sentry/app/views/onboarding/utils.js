// import {platforms} from '../../../../../integration-docs/_platforms.json';
// eslint-disable-next-line import/extensions
import {platforms} from 'integration-docs-platforms';
import {t} from 'app/locale';

const popular = [
  'javascript',
  'javascript-react',
  'python-django',
  'python',
  'python-flask',
  'ruby-rails',
  'node-express',
  'php-laravel',
  'php-symfony2',
  'java',
  'csharp',
  'exilir',
  'php',
  'ruby',
  'node',
  'cocoa',
  'javascript-angular',
];

const frontend = [
  'javascript',
  'javascript-react',
  'javascript-angular',
  'javascript-angularjs',
  'javascript-backbone',
  'javascript-ember',
  'javascript-vue',
];

const mobile = ['objc', 'swift', 'java-android', 'cocoa', 'cordova'];

const backend = [
  'go',
  'go-http',
  'java-appengine',
  'java',
  'java-log4j',
  'java-log4j2',
  'java-logback',
  'java-logging',
  'node',
  'node-express',
  'node-koa',
  'node-connect',
  'csharp',
  'php',
  'php-laravel',
  'php-monolog',
  'php-symfony2',
  'python',
  'python-django',
  'python-flask',
  'python-celery',
  'python-bottle',
  'python-pylons',
  'python-pyramid',
  'python-tornado',
  'python-rq',
  'ruby',
  'ruby-rails',
  'ruby-rack',
  'rust',
  'elixir',
];

const desktop = ['cocoa', 'csharp', 'java', 'electron', 'minidump'];

const categoryList = [
  {id: 'popular', name: t('Popular'), platforms: popular},
  {id: 'browser', name: t('Browser'), platforms: frontend},
  {id: 'server', name: t('Server'), platforms: backend},
  {id: 'mobile', name: t('Mobile'), platforms: mobile},
  {id: 'desktop', name: t('Desktop'), platforms: desktop},
];

const additional = platforms.concat({
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
});

const flattenedPlatforms = [].concat(
  [],
  ...additional.map(language => {
    return language.integrations.map(i => {
      return {...i, language: language.id};
    });
  })
);

const onboardingSteps = {organization: 0, project: 1, configure: 2};

const stepDescriptions = {
  organization: t('Create an organization in Sentry'),
  project: t('Tell us about your project'),
  configure: t('Configure your application and send an event'),
};

function getPlatformName(platform) {
  let platformData = flattenedPlatforms.find(({id}) => platform == id);
  return platformData && platformData.name;
}

export {
  onboardingSteps,
  stepDescriptions,
  flattenedPlatforms,
  categoryList,
  getPlatformName,
};
