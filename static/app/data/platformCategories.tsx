import {t} from 'app/locale';

const popular = [
  'javascript',
  'javascript-react',
  'javascript-nextjs',
  'python-django',
  'python',
  'python-flask',
  'ruby-rails',
  'node-express',
  'php-laravel',
  'java',
  'java-spring-boot',
  'dotnet',
  'dotnet-aspnetcore',
  'csharp',
  'go',
  'php',
  'ruby',
  'node',
  'react-native',
  'javascript-angular',
  'javascript-vue',
  'android',
  'apple-ios',
  'flutter',
  'dart-flutter',
] as const;

export const frontend = [
  'dart',
  'javascript',
  'javascript-react',
  'javascript-angular',
  'javascript-angularjs',
  'javascript-backbone',
  'javascript-ember',
  'javascript-gatsby',
  'javascript-vue',
  'javascript-nextjs',
] as const;

export const mobile = [
  'android',
  'apple-ios',
  'cordova',
  'capacitor',
  'javascript-cordova',
  'javascript-capacitor',
  'react-native',
  'flutter',
  'dart-flutter',
  'unity',
  'dotnet-xamarin',
  // Old platforms
  'java-android',
  'cocoa-objc',
  'cocoa-swift',
] as const;

export const backend = [
  'dotnet',
  'dotnet-aspnetcore',
  'dotnet-aspnet',
  'elixir',
  'go',
  'go-http',
  'java',
  'java-appengine',
  'java-log4j',
  'java-log4j2',
  'java-logback',
  'java-logging',
  'java-spring',
  'java-spring-boot',
  'native',
  'node',
  'node-express',
  'node-koa',
  'node-connect',
  'perl',
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
  'ruby',
  'ruby-rails',
  'ruby-rack',
  'rust',
] as const;

export const serverless = [
  'python-awslambda',
  'python-azurefunctions',
  'python-gcpfunctions',
  'node-awslambda',
  'node-azurefunctions',
  'node-gcpfunctions',
  'dotnet-awslambda',
  'dotnet-gcpfunctions',
] as const;

export const desktop = [
  'apple-macos',
  'dotnet',
  'dotnet-winforms',
  'dotnet-wpf',
  'java',
  'electron',
  'javascript-electron',
  'native',
  'native-crashpad',
  'native-breakpad',
  'native-minidump',
  'native-qt',
  'minidump',
  'unity',
] as const;

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

export const tracing = [
  'python-tracing',
  'node-tracing',
  'react-native-tracing',
] as const;

export const performance: PlatformKey[] = [
  'javascript',
  'javascript-ember',
  'javascript-react',
  'javascript-vue',
  'php',
  'php-laravel',
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
  'node',
  'node-express',
  'node-koa',
  'node-connect',
];

export const releaseHealth: PlatformKey[] = [
  // frontend
  'javascript',
  'javascript-react',
  'javascript-angular',
  'javascript-angularjs',
  'javascript-backbone',
  'javascript-ember',
  'javascript-gatsby',
  'javascript-vue',
  'javascript-nextjs',
  // mobile
  'android',
  'apple-ios',
  'cordova',
  'javascript-cordova',
  'react-native',
  'flutter',
  'dart-flutter',
  // backend
  'native',
  'node',
  'node-express',
  'node-koa',
  'node-connect',
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
  'rust',
  // serverless
  // desktop
  'apple-macos',
  'native',
  'native-crashpad',
  'native-breakpad',
  'native-qt',
];

/**
 * Additional aliases used for filtering in the platform picker
 */
export const filterAliases: Partial<Record<PlatformKey, string[]>> = {
  native: ['cpp', 'c++'],
};

export type PlatformKey =
  | typeof popular[number]
  | typeof frontend[number]
  | typeof mobile[number]
  | typeof backend[number]
  | typeof desktop[number]
  | typeof tracing[number]
  | typeof serverless[number]
  | 'other';

export default categoryList;
