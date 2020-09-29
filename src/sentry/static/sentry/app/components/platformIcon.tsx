import React from 'react';
import styled from '@emotion/styled';

const PLATFORM_TO_ICON = {
  android: 'android',
  apple: 'apple',
  'apple-ios': 'apple',
  'apple-macos': 'apple',
  cordova: 'cordova',
  dotnet: 'dotnet',
  'dotnet-aspnetcore': 'dotnet',
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
  'javascript-cordova': 'cordova',
  'javascript-electron': 'electron',
  'javascript-ember': 'ember',
  'javascript-react': 'react',
  'javascript-vue': 'vue',
  native: 'nativec',
  node: 'nodejs',
  'node-connect': 'nodejs',
  'node-express': 'express',
  'node-koa': 'koa',
  'node-awslambda': 'aws',
  'node-azurefunctions': 'azure',
  'node-gcpfunctions': 'gcp',
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
  'python-awslambda': 'aws',
  'python-azurefunctions': 'azure',
  'python-gcpfunctions': 'gcp',
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

const IconContainer = styled('div')`
  position: relative;
`;

const LanguageIcon = styled('img')`
  position: absolute;
  bottom: -1px;
  right: -1px;
  height: 30%;
  width: 30%;
  border-radius: 2px;
`;

type Props = {
  platform: string;
  size?: string;
  width?: string;
  height?: string;
  withLanguageIcon?: boolean;
};

const PlatformIcon = ({platform, size, withLanguageIcon, ...props}: Props) => {
  const width = props.width || size || '1em';
  const height = props.height || size || '1em';

  const icon = getIcon(platform);

  const iconPath = require(`platformicons/${
    size === 'lg' ? 'svg_80x80' : 'svg'
  }/${icon}.svg`);

  const language = platform.split('-')[0];
  const langIcon = getIcon(language);

  if (withLanguageIcon && langIcon !== icon && langIcon !== 'default') {
    const langPath = require(`platformicons/svg/${getIcon(language)}.svg`);

    return (
      <IconContainer {...props}>
        <img src={iconPath} width={width} height={height} />
        <LanguageIcon src={langPath} />
      </IconContainer>
    );
  }

  return <img src={iconPath} width={width} height={height} {...props} />;
};

export default PlatformIcon;
