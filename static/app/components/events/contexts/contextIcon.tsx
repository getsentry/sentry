import {PlatformIcon, platforms} from 'platformicons';
import logoUnknown from 'sentry-logos/logo-unknown.svg';

import {SvgIcon, type SVGIconProps} from 'sentry/icons/svgIcon';

const LOGO_MAPPING: Readonly<Record<string, string>> = {
  'android-phone': 'android-phone',
  'android-tablet': 'android-tablet',
  'google-chrome': 'chrome',
  'internet-explorer': 'internet-explorer',
  'legacy-edge': 'edge-legacy',
  'mac-os-x': 'apple',
  'mobile-safari': 'safari',
  'nintendo-switch': 'nintendo-switch',
  'nintendo-switch-2': 'nintendo-switch-2',
  'net-core': 'dotnetcore',
  'net-framework': 'dotnetframework',
  'qq-browser': 'qq',
  'microsoft-edge': 'edge',
  amazon: 'amazon',
  amd: 'amd',
  android: 'android',
  bazzite: 'bazzite',
  apple: 'apple',
  appletv: 'apple-tv',
  arm: 'arm',
  chrome: 'chrome',
  chromium: 'chromium',
  cloudflare: 'cloudflare',
  cpython: 'python',
  crystal: 'crystal',
  darwin: 'apple',
  deno: 'deno',
  edge: 'edge',
  electron: 'electron',
  firefox: 'firefox',
  google: 'android',
  il: 'unity',
  ios: 'apple',
  ipad: 'apple-ipad',
  iphone: 'apple-iphone',
  ipod: 'apple-iphone',
  linux: 'linux',
  mac: 'apple',
  macos: 'apple',
  mono: 'mono',
  motorola: 'motorola',
  net: 'dotnet',
  node: 'node',
  nvidia: 'nvidia',
  opera: 'opera',
  php: 'php',
  playstation: 'playstation',
  python: 'python',
  ruby: 'ruby',
  safari: 'safari',
  samsung: 'samsung',
  steamos: 'steamos',
  tvos: 'apple-tv',
  ubuntu: 'ubuntu',
  vercel: 'vercel',
  watch: 'apple-watch',
  watchos: 'apple-watch',
  windows: 'windows',
  xbox: 'xbox',
};

/** @internal used in stories **/
export const NAMES = Object.keys(LOGO_MAPPING);

const PLATFORM_ICONS = new Set<string>(platforms);

const PREFIX_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['amd-', 'amd'],
  ['nvidia-', 'nvidia'],
  ['nintendo-', 'nintendo-switch'],
  ['chrome-', 'chrome'],
  ['firefox-', 'firefox'],
];

export function getLogoImage(name: string) {
  const mapped = LOGO_MAPPING[name];
  const prefixed = PREFIX_ALIASES.find(([prefix]) => name.startsWith(prefix))?.[1];
  const icon = mapped ?? prefixed ?? name;

  if (PLATFORM_ICONS.has(icon)) {
    return icon;
  }
  const dash = icon.indexOf('-');
  if (dash > 0 && PLATFORM_ICONS.has(icon.slice(0, dash))) {
    return icon;
  }
  return logoUnknown;
}

export interface ContextIconProps {
  name: string;
  size?: SVGIconProps['size'];
}

export function ContextIcon({name, size: providedSize = 'xl'}: ContextIconProps) {
  const size = SvgIcon.ICON_SIZES[providedSize];
  const platformIconName = getLogoImage(name);

  return (
    <PlatformIcon
      platform={platformIconName === logoUnknown ? 'default' : platformIconName}
      size={size}
    />
  );
}
