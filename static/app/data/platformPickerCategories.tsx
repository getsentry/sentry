import {t} from 'sentry/locale';
import {PlatformKey} from 'sentry/types';

const popularPlatformCategories: Set<PlatformKey> = new Set([
  'android',
  'apple-ios',
  'dotnet',
  'dotnet-aspnetcore',
  'flutter',
  'go',
  'java',
  'java-spring-boot',
  'javascript',
  'javascript-angular',
  'javascript-nextjs',
  'javascript-react',
  'javascript-vue',
  'node',
  'node-express',
  'php',
  'php-laravel',
  'python',
  'python-django',
  'python-fastapi',
  'python-flask',
  'react-native',
  'ruby-rails',
  'ruby',
  'unity',
]);

const browser: Set<PlatformKey> = new Set([
  'dart',
  'javascript',
  'javascript-angular',
  'javascript-astro',
  'javascript-ember',
  'javascript-gatsby',
  'javascript-nextjs',
  'javascript-react',
  'javascript-remix',
  'javascript-svelte',
  'javascript-sveltekit',
  'javascript-vue',
  'unity',
]);

const server: Set<PlatformKey> = new Set([
  'bun',
  'dotnet',
  'dotnet-aspnet',
  'dotnet-aspnetcore',
  'elixir',
  'go',
  'go-http',
  'java',
  'java-log4j2',
  'java-logback',
  'java-spring',
  'java-spring-boot',
  'kotlin',
  'native',
  'node',
  'node-connect',
  'node-express',
  'node-koa',
  'php',
  'php-laravel',
  'php-symfony',
  'python',
  'python-aiohttp',
  'python-asgi',
  'python-bottle',
  'python-celery',
  'python-chalice',
  'python-django',
  'python-falcon',
  'python-fastapi',
  'python-flask',
  'python-pyramid',
  'python-quart',
  'python-rq',
  'python-sanic',
  'python-starlette',
  'python-tornado',
  'python-tryton',
  'python-wsgi',
  'ruby',
  'ruby-rack',
  'ruby-rails',
  'rust',
]);

const mobile: Set<PlatformKey> = new Set([
  'android',
  'apple-ios',
  'capacitor',
  'cordova',
  'dotnet-maui',
  'dotnet-xamarin',
  'flutter',
  'ionic',
  'react-native',
  'unity',
  'unreal',
]);

const desktop: Set<PlatformKey> = new Set([
  'apple-macos',
  'dotnet',
  'dotnet-maui',
  'dotnet-winforms',
  'dotnet-wpf',
  'electron',
  'flutter',
  'java',
  'kotlin',
  'minidump',
  'native',
  'native-qt',
  'unity',
  'unreal',
]);

const serverless: Set<PlatformKey> = new Set([
  'dotnet-awslambda',
  'dotnet-gcpfunctions',
  'node-awslambda',
  'node-azurefunctions',
  'node-gcpfunctions',
  'python-awslambda',
  'python-gcpfunctions',
  'python-serverless',
]);

export const createablePlatforms: Set<PlatformKey> = new Set([
  ...popularPlatformCategories,
  ...browser,
  ...server,
  ...mobile,
  ...desktop,
  ...serverless,
]);

/**
 * Additional aliases used for filtering in the platform picker
 */
export const filterAliases: Partial<Record<PlatformKey, string[]>> = {
  native: ['cpp', 'c++'],
};

const categoryList = [
  {id: 'popular', name: t('Popular'), platforms: popularPlatformCategories},
  {id: 'browser', name: t('Browser'), platforms: browser},
  {id: 'server', name: t('Server'), platforms: server},
  {id: 'mobile', name: t('Mobile'), platforms: mobile},
  {id: 'desktop', name: t('Desktop'), platforms: desktop},
  {id: 'serverless', name: t('Serverless'), platforms: serverless},
  {
    id: 'all',
    name: t('All'),
    platforms: createablePlatforms,
  },
];

export default categoryList;

// TODO(aknaus): Drop in favour of PlatformIntegration
export type Platform = {
  key: PlatformKey;
  id?: string;
  link?: string | null;
  name?: string;
};
