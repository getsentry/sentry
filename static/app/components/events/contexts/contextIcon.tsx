import {css, useTheme} from '@emotion/react';
import logoAmazon from 'sentry-logos/logo-amazon.svg';
import logoAmd from 'sentry-logos/logo-amd.svg';
import logoAndroid from 'sentry-logos/logo-android.svg';
import logoAndroidPhone from 'sentry-logos/logo-android-phone.svg';
import logoAndroidTablet from 'sentry-logos/logo-android-tablet.svg';
import logoApple from 'sentry-logos/logo-apple.svg';
import logoApplePhone from 'sentry-logos/logo-apple-phone.svg';
import logoAppleTablet from 'sentry-logos/logo-apple-tablet.svg';
import logoAppleTv from 'sentry-logos/logo-apple-tv.svg';
import logoAppleWatch from 'sentry-logos/logo-apple-watch.svg';
import logoArm from 'sentry-logos/logo-arm.svg';
import logoChrome from 'sentry-logos/logo-chrome.svg';
import logoChromium from 'sentry-logos/logo-chromium.svg';
import logoCloudflareWorker from 'sentry-logos/logo-cloudflare-worker.svg';
import logoCrystal from 'sentry-logos/logo-crystal.svg';
import logoDeno from 'sentry-logos/logo-deno.svg';
import logoDotnet from 'sentry-logos/logo-dotnet.svg';
import logoEdgeNew from 'sentry-logos/logo-edge-new.svg';
import logoEdgeOld from 'sentry-logos/logo-edge-old.svg';
import logoElectron from 'sentry-logos/logo-electron.svg';
import logoFirefox from 'sentry-logos/logo-firefox.svg';
import logoGoogle from 'sentry-logos/logo-google.svg';
import logoIe from 'sentry-logos/logo-ie.svg';
import logoLinux from 'sentry-logos/logo-linux.svg';
import logoMonogorilla from 'sentry-logos/logo-monogorilla.svg';
import logoMotorola from 'sentry-logos/logo-motorola.svg';
import logoNetcore from 'sentry-logos/logo-netcore.svg';
import logoNetframework from 'sentry-logos/logo-netframework.svg';
import logoNintendo from 'sentry-logos/logo-nintendo.svg';
import logoNintendoSwitch from 'sentry-logos/logo-nintendo-switch.svg';
import logoNode from 'sentry-logos/logo-node.svg';
import logoNvidia from 'sentry-logos/logo-nvidia.svg';
import logoOpera from 'sentry-logos/logo-opera.svg';
import logoPhp from 'sentry-logos/logo-php.svg';
import logoPlaystation from 'sentry-logos/logo-playstation.svg';
import logoPython from 'sentry-logos/logo-python.svg';
import logoQq from 'sentry-logos/logo-qq.svg';
import logoRuby from 'sentry-logos/logo-ruby.svg';
import logoSafari from 'sentry-logos/logo-safari.svg';
import logoSamsung from 'sentry-logos/logo-samsung.svg';
import logoUbuntu from 'sentry-logos/logo-ubuntu.svg';
import logoUnity from 'sentry-logos/logo-unity.svg';
import logoUnknown from 'sentry-logos/logo-unknown.svg';
import logoVercel from 'sentry-logos/logo-vercel.svg';
import logoWindows from 'sentry-logos/logo-windows.svg';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {IconSize} from 'sentry/utils/theme';

const LOGO_MAPPING = {
  'android-phone': logoAndroidPhone,
  'android-tablet': logoAndroidTablet,
  'chrome-mobile-ios': logoChrome,
  'google-chrome': logoChrome,
  'internet-explorer': logoIe,
  'legacy-edge': logoEdgeOld,
  'mac-os-x': logoApple,
  'chrome-os': logoChrome,
  'mobile-safari': logoSafari,
  'nintendo-switch': logoNintendoSwitch,
  'net-core': logoNetcore,
  'net-framework': logoNetframework,
  'qq-browser': logoQq,
  'nintendo-os': logoNintendo,
  amazon: logoAmazon,
  amd: logoAmd,
  android: logoAndroid,
  apple: logoApple,
  appletv: logoAppleTv,
  arm: logoArm,
  chrome: logoChrome,
  chromium: logoChromium,
  cloudflare: logoCloudflareWorker,
  cpython: logoPython,
  crystal: logoCrystal,
  darwin: logoApple,
  deno: logoDeno,
  edge: logoEdgeNew,
  electron: logoElectron,
  firefox: logoFirefox,
  google: logoGoogle,
  il: logoUnity,
  ios: logoApple,
  ipad: logoAppleTablet,
  iphone: logoApplePhone,
  ipod: logoApplePhone,
  linux: logoLinux,
  mac: logoApple,
  macos: logoApple,
  mono: logoMonogorilla,
  motorola: logoMotorola,
  net: logoDotnet,
  node: logoNode,
  nvidia: logoNvidia,
  opera: logoOpera,
  php: logoPhp,
  playstation: logoPlaystation,
  python: logoPython,
  ruby: logoRuby,
  safari: logoSafari,
  samsung: logoSamsung,
  tvos: logoApple,
  ubuntu: logoUbuntu,
  vercel: logoVercel,
  watch: logoAppleWatch,
  watchos: logoApple,
  windows: logoWindows,
};

export const NAMES = Object.keys(LOGO_MAPPING);

// The icons in this list will be inverted when the theme is set to dark mode
const INVERT_IN_DARKMODE = [
  'darwin',
  'ios',
  'macos',
  'tvos',
  'mac-os-x',
  'mac',
  'apple',
  'watchos',
  'vercel',
];

const darkCss = css`
  filter: invert(100%);
  opacity: 0.8;
`;

export function getLogoImage(name: string) {
  if (name.startsWith('amd-')) {
    return logoAmd;
  }

  if (name.startsWith('nvidia-')) {
    return logoNvidia;
  }

  return LOGO_MAPPING[name] ?? logoUnknown;
}

export interface ContextIconProps {
  name: string;
  size?: IconSize;
}

export function ContextIcon({name, size: providedSize = 'xl'}: ContextIconProps) {
  const theme = useTheme();
  const size = theme.iconSizes[providedSize];

  // Apply darkmode CSS to icon when in darkmode
  const isDarkmode = useLegacyStore(ConfigStore).theme === 'dark';
  const extraCass = isDarkmode && INVERT_IN_DARKMODE.includes(name) ? darkCss : null;

  const imageName = getLogoImage(name);

  return <img height={size} width={size} css={extraCass} src={imageName} />;
}

export default ContextIcon;
