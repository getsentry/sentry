// import {platforms} from '../../../../../integration-docs/_platforms.json';
import {platforms} from 'integration-docs-platforms';

const Popular = [
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
  'exilir'
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
  organization: 'Create an organization in Sentry',
  project: 'Tell us about your project',
  configure: 'Configure your application and send an event'
};

export {onboardingSteps, stepDescriptions, flattenedPlatforms, categoryLists};
