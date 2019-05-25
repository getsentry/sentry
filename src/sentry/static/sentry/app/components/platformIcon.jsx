import PropTypes from 'prop-types';
import React from 'react';

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
  'react-native': 'apple',
  ruby: 'ruby',
  'ruby-rack': 'ruby',
  'ruby-rails': 'rails',
  rust: 'rust',
  swift: 'swift',
  // TODO: AWS used to be python-awslambda but the displayed generic icon
  // We need to figure out what is causing it to be python-pythonawslambda
};

export function getIcon(platform) {
  const icon = PLATFORM_TO_ICON[platform];

  if (!icon) {
    return 'generic';
  } else {
    return icon;
  }
}

const Platformicon = ({platform, size, width, height, ...props}) => {
  const icon = getIcon(platform);

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
