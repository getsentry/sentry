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
  'elixir',
  'php',
  'ruby',
  'node',
  'react-native',
  'javascript-angular',
] as const;

const frontend = [
  'javascript',
  'javascript-react',
  'javascript-angular',
  'javascript-angularjs',
  'javascript-backbone',
  'javascript-ember',
  'javascript-vue',
] as const;

const mobile = [
  'cocoa-objc',
  'cocoa-swift',
  'java-android',
  'cordova',
  'react-native',
  'flutter',
] as const;

const backend = [
  'csharp',
  'elixir',
  'go',
  'go-http',
  'java-appengine',
  'java',
  'java-log4j',
  'java-log4j2',
  'java-logback',
  'java-logging',
  'native',
  'node',
  'node-express',
  'node-koa',
  'node-connect',
  'php',
  'php-laravel',
  'php-monolog',
  'php-symfony2',
  'python',
  'python-django',
  'python-flask',
  'python-sanic',
  'python-celery',
  'python-bottle',
  'python-pylons',
  'python-pyramid',
  'python-tornado',
  'python-rq',
  'python-awslambda',
  'ruby',
  'ruby-rails',
  'ruby-rack',
  'rust',
] as const;

const serverless = [
  'python-pythonawslambda',
  'python-pythongcpfunctions',
  'python-pythonazurefunctions',
  'node-gcpfunctions',
  'node-azurefunctions',
  'node-awslambda',
] as const;

const desktop = ['cocoa', 'csharp', 'java', 'electron', 'minidump', 'native'] as const;

const categoryList = [
  {id: 'popular', name: t('Popular'), platforms: popular},
  {id: 'browser', name: t('Browser'), platforms: frontend},
  {id: 'server', name: t('Server'), platforms: backend},
  {id: 'mobile', name: t('Mobile'), platforms: mobile},
  {id: 'desktop', name: t('Desktop'), platforms: desktop},
  {id: 'serverless', name: t('Serverless'), platforms: serverless},
] as const;

export const sourceMaps: PlatformKey[] = [
  ...frontend,
  'react-native',
  'cordova',
  'electron',
];

// TODO(epurkhiser): I've added these since there was a need to have them in
// the platform key type. However I have not added them anywhere else.
const tracing = ['python-tracing', 'node-tracing'] as const;

export type PlatformKey =
  | typeof popular[number]
  | typeof frontend[number]
  | typeof mobile[number]
  | typeof backend[number]
  | typeof desktop[number]
  | typeof serverless[number]
  | typeof tracing[number]
  | 'other';

export default categoryList;
