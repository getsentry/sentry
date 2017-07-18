import {platforms} from '../../../../../integration-docs/_platforms.json';

const Popular = [
  'javascript',
  'python-django',
  'ruby-rails',
  'node-express',
  'php-laravel',
  'php-symfony2',
  'java'
];

const Frontend = [
  'javascript',
  'javascript-react',
  'javascript-angular',
  'javascript-angularjs',
  'javascript-backbone',
  'javascript-ember',
  'javascript-vue'
];

const Mobile = ['objc', 'swift', 'java-android', 'cocoa'];

const Backend = [
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
  'exilir'
];

const categoryLists = {
  Popular,
  Frontend,
  Mobile,
  Backend
};

const additional = platforms.concat({
  integrations: [
    {
      link: 'https://docs.getsentry.com/hosted/clients/',
      type: 'language',
      id: 'other',
      name: 'Other'
    }
  ],
  id: 'other',
  name: 'Other'
});

const onboardingSteps = {organization: 0, project: 1, configure: 2};

const stepDescriptions = {
  organization: 'Create an Organization in Sentry',
  project: 'Tell us about your project',
  configure: 'Configure your application and send an event'
};

const flattenedPlatforms = [].concat(
  [],
  ...additional.map(language => {
    return language.integrations.map(i => {
      return {...i, language: language.id};
    });
  })
);

export {onboardingSteps, stepDescriptions, flattenedPlatforms, categoryLists};
