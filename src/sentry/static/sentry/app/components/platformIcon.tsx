import React from 'react';

const PLATFORM_TO_ICON = {
  apple: 'apple',
  cocoa: 'apple',
  'cocoa-objc': 'apple',
  'cocoa-swift': 'swift',
  cordova: 'cordova',
  csharp: 'csharp',
  'csharp-aspnetcore': 'dotnet',
  elixir: 'elixir',
  electron: 'electron',
  go: 'go',
  java: 'java',
  'java-android': 'android',
  'java-appengine': 'app-engine',
  'java-log4j': 'java',
  'java-log4j2': 'java',
  'java-logback': 'logback',
  'java-logging': 'java',
  javascript: 'javascript',
  'javascript-angular': 'angularjs',
  'javascript-angularjs': 'angularjs',
  'javascript-backbone': 'backbone',
  'javascript-browser': 'javascript',
  'javascript-ember': 'ember',
  'javascript-react': 'react',
  'javascript-vue': 'vue',
  native: 'nativec',
  node: 'nodejs',
  'node-connect': 'nodejs',
  'node-express': 'express',
  'node-koa': 'koa',
  'objective-c': 'apple',
  perl: 'perl',
  php: 'php',
  'php-laravel': 'laravel',
  'php-monolog': 'php',
  'php-symfony2': 'symfony',
  'php-symfony': 'symfony',
  python: 'python',
  'python-flask': 'flask',
  'python-aiohttp': 'aiohttp',
  'python-pythonawslambda': 'aws',
  'python-pythonazurefunctions': 'azure',
  'python-pythongcpfunctions': 'gcp',
  'python-sanic': 'python',
  'python-bottle': 'bottle',
  'python-celery': 'python',
  'python-django': 'django',
  'python-falcon': 'falcon',
  'python-pylons': 'python',
  'python-pyramid': 'pyramid',
  'python-rq': 'redis',
  'python-tornado': 'tornado',
  'python-tryton': 'tryton',
  'react-native': 'react',
  ruby: 'ruby',
  'ruby-rack': 'ruby',
  'ruby-rails': 'rails',
  rust: 'rust',
  flutter: 'flutter',
  dart: 'dart',
  // TODO: AWS used to be python-awslambda but the displayed generic icon
  // We need to figure out what is causing it to be python-pythonawslambda
};

export function getIcon(platform: string): string {
  const icon = PLATFORM_TO_ICON[platform];

  if (!icon) {
    return 'default';
  }

  return icon;
}

type Props = {
  platform: string;
  size?: string;
  width?: string;
  height?: string;
};

const PlatformIcon = ({platform, size, ...props}: Props) => {
  const width = props.width || size || '1em';
  const height = props.height || size || '1em';

  const icon = getIcon(platform);

  const iconPath = require(`platformicons/${
    size === 'lg' ? 'svg_80x80' : 'svg'
  }/${icon}.svg`);

  return <img src={iconPath} width={width} height={height} {...props} />;
};

export default PlatformIcon;
