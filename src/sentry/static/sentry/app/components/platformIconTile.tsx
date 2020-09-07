import PropTypes from 'prop-types';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

const PLATFORM_ICONS = {
  'app-engine': '\\e60b',
  'c-sharp': '\\e60f',
  'java-appengine': '\\e60b',
  'javascript-angular': '\\e900',
  'javascript-angularjs': '\\e900',
  'javascript-ember': '\\e800',
  'javascript-react': '\\e801',
  'objective-c': '\\e60e',
  'php-laravel': '\\e60d',
  'python-bottle': '\\e60c',
  'python-django': '\\e605',
  'python-flask': '\\e610',
  'ruby-rails': '\\e603',
  angular: '\\e900',
  angularjs: '\\e900',
  apple: '\\e60e',
  bottle: '\\e60c',
  csharp: '\\e60f',
  django: '\\e605',
  dotnet: '\\e902',
  elixir: '\\e903',
  ember: '\\e800',
  flask: '\\e610',
  generic: '\\e60a',
  go: '\\e606',
  ios: '\\e607',
  java: '\\e608',
  javascript: '\\e600',
  js: '\\e600',
  laravel: '\\e60d',
  node: '\\e609',
  objc: '\\e60e',
  perl: '\\e901',
  php: '\\e601',
  python: '\\e602',
  rails: '\\e603',
  react: '\\e801',
  ruby: '\\e604',
  swift: '\\e60e',
} as const;

// platformName: [background, forground]
const PLATFORM_COLORS = {
  python: ['#3060b8'],
  javascript: ['#ecd744', '#111'],
  ruby: ['#e03e2f', '#fff'],
  rails: ['#e03e2f', '#fff'],
  java: ['#ec5e44'],
  php: ['#6c5fc7'],
  node: ['#90c541'],
  csharp: ['#638cd7'],
  go: ['#fff', '#493e54'],
  elixir: ['#4e3fb4'],
  'app-engine': ['#ec5e44'],
  'python-django': ['#57be8c'],
  'javascript-react': ['#2d2d2d', '#00d8ff'],
  'javascript-ember': ['#ed573e', '#fff'],
  'javascript-angular': ['#e03e2f', '#fff'],
} as const;

const selectPlatfrom = (
  object: typeof PLATFORM_ICONS | typeof PLATFORM_COLORS,
  platform: string
) => object[platform] || object[platform.split('-')[0]];

const getColorStyles = ({monoTone, platform}: Props) => {
  const [bg, fg] = selectPlatfrom(PLATFORM_COLORS, platform) || [];

  return (
    !monoTone &&
    css`
      background-color: ${bg || '#625471'};
      color: ${fg || '#fff'};
    `
  );
};

type Props = {
  platform: keyof typeof PLATFORM_ICONS;
  className?: string;
  monoTone?: boolean;
};

const PlatformIconTile = styled('div', {
  shouldForwardProp: prop => prop !== 'platform' && prop !== 'monoTone',
})<Props>`
  /* stylelint-disable-next-line font-family-no-missing-generic-family-keyword */
  font-family: 'platformicons';
  font-weight: normal;
  speak: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  ${getColorStyles};

  &:before {
    content: '${p => selectPlatfrom(PLATFORM_ICONS, p.platform) || '\\e60a'}';
  }
`;

PlatformIconTile.propTypes = {
  platform: PropTypes.any,
  className: PropTypes.string,
  monoTone: PropTypes.bool,
};

export default PlatformIconTile;
