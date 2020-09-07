import React from 'react';
import styled from '@emotion/styled';

import PlatformIconTile from './platformIconTile';

const PLATFORM_TO_ICON = {
  apple: 'apple',
  cocoa: 'apple',
  cordova: 'cordova',
  csharp: 'csharp',
  elixir: 'elixir',
  electron: 'electron',
  go: 'go',
  java: 'java',
  'java-android': 'java',
  'java-appengine': 'app-engine',
  'java-log4j': 'java',
  'java-log4j2': 'java',
  'java-logback': 'java',
  'java-logging': 'java',
  javascript: 'javascript',
  'javascript-angular': 'angularjs',
  'javascript-backbone': 'javascript',
  'javascript-ember': 'ember',
  'javascript-react': 'react',
  'javascript-vue': 'vue',
  node: 'nodejs',
  'node-connect': 'nodejs',
  'node-express': 'nodejs',
  'node-koa': 'nodejs',
  'objective-c': 'apple',
  perl: 'perl',
  php: 'php',
  'php-laravel': 'laravel',
  'php-monolog': 'php',
  'php-symfony2': 'php',
  python: 'python',
  'python-flask': 'flask',
  'python-sanic': 'python',
  'python-bottle': 'bottle',
  'python-celery': 'python',
  'python-django': 'django',
  'python-pylons': 'python',
  'python-pyramid': 'python',
  'python-rq': 'python',
  'python-tornado': 'python',
  'python-pythonawslambda': 'python',
  ruby: 'ruby',
  'ruby-rack': 'ruby',
  'ruby-rails': 'rails',
  'react-native': 'react-native',
  rust: 'rust',
  swift: 'swift',
  flutter: 'flutter',
  dart: 'dart',
  // TODO: AWS used to be python-awslambda but the displayed generic icon
  // We need to figure out what is causing it to be python-pythonawslambda
};

export function getIcon(platform: string): string {
  const icon = PLATFORM_TO_ICON[platform];

  if (!icon) {
    return 'generic';
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

  if (platform === 'react-native') {
    // TODO(Priscila): find a better way to do it, maybe by removing the react svg path fill attributes
    return (
      <StyledPlatformIconTile
        platform={platform as any} // TODO(ts): this will be removed once new platformicons land
        width={width}
        height={height}
        {...props}
      />
    );
  }

  const icon = getIcon(platform);

  return (
    <img
      src={require(`platformicons/svg/${icon}.svg`)}
      width={width}
      height={height}
      {...props}
    />
  );
};

export default PlatformIcon;

// TODO(color): theme doesn't have the color #625471
const StyledPlatformIconTile = styled(PlatformIconTile, {
  shouldForwardProp: prop => prop !== 'width' && prop !== 'height',
})<{width: string; height: string}>`
  width: ${p => p.width};
  height: ${p => p.height};
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  :before {
    position: absolute;
  }
`;
