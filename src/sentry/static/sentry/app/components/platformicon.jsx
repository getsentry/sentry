import PropTypes from 'prop-types';
import React from 'react';

const PLATFORM_TO_ICON = {
  apple: 'apple',
  cocoa: 'apple',
  csharp: 'csharp',
  elixir: 'elixir',
  go: 'go',
  java: 'java',
  'java-android': 'java',
  'java-appengine': 'app-engine',
  'java-log4j': 'java',
  'java-log4j2': 'java',
  'java-logback': 'java',
  'java-logging': 'java',
  javascript: 'javascript',
  'javascript-angular': 'angular',
  'javascript-backbone': 'javascript',
  'javascript-ember': 'ember',
  'javascript-react': 'react',
  'javascript-vue': 'javascript',
  node: 'nodejs',
  'node-connect': 'nodejs',
  'node-express': 'nodejs',
  'node-koa': 'nodejs',
  'objective-c': 'apple',
  php: 'php',
  'php-laravel': 'laravel',
  'php-monolog': 'php',
  'php-symfony2': 'php',
  python: 'python',
  'python-flask': 'flask',
  'python-bottle': 'bottle',
  'python-celery': 'python',
  'python-django': 'django',
  'python-pylons': 'python',
  'python-pyramid': 'python',
  'python-rq': 'python',
  'python-tornado': 'python',
  'react-native': 'apple',
  ruby: 'ruby',
  'ruby-rack': 'ruby',
  'ruby-rails': 'rails',
  swift: 'swift',
};

export function getIcon(platform) {
  let icon = PLATFORM_TO_ICON[platform];

  if (!icon) {
    return 'generic';
  } else {
    return icon;
  }
}

const Platformicon = ({platform, size, width, height, ...props}) => {
  let icon = getIcon(platform);

  return (
    <img
      src={require(`platformicons/svg/${icon}.svg`)}
      width={width || size || '1em'}
      height={height || size || '1em'}
      {...props}
    />
  );
};

Platformicon.propTypes = {
  platform: PropTypes.string.isRequired,
  size: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
};

export default Platformicon;
