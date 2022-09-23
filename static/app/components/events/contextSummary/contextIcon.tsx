import {css} from '@emotion/react';
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
import logoCrystal from 'sentry-logos/logo-crystal.svg';
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
import logoWindows from 'sentry-logos/logo-windows.svg';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

const LOGO_MAPPING = {
  'android-phone': logoAndroidPhone,
  'android-tablet': logoAndroidTablet,
  'chrome-mobile': logoChrome,
  'chrome-mobile-ios': logoChrome,
  'internet-explorer': logoIe,
  'legacy-edge': logoEdgeOld,
  'mac-os-x': logoApple,
  'mobile-safari': logoSafari,
  'net-core': logoNetcore,
  'net-framework': logoNetframework,
  'qq-browser': logoQq,
  amazon: logoAmazon,
  amd: logoAmd,
  android: logoAndroid,
  apple: logoApple,
  appletv: logoAppleTv,
  arm: logoArm,
  chrome: logoChrome,
  chromium: logoChromium,
  cpython: logoPython,
  crystal: logoCrystal,
  darwin: logoApple,
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
  watch: logoAppleWatch,
  watchos: logoApple,
  windows: logoWindows,
};

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
];

const darkCss = css`
  filter: invert(100%);
  opacity: 0.8;
`;

function getLogoImage(name: string) {
  if (name.startsWith('amd-')) {
    return logoAmd;
  }

  if (name.startsWith('nvidia-')) {
    return logoNvidia;
  }

  return LOGO_MAPPING[name] ?? logoUnknown;
}

type Props = {
  name: string;
};

function ContextIcon({name}: Props) {
  // Apply darkmode CSS to icon when in darkmode
  const isDarkmode = useLegacyStore(ConfigStore).theme === 'dark';
  const extraCass = isDarkmode && INVERT_IN_DARKMODE.includes(name) ? darkCss : null;

  return <img height="32px" width="32px" css={extraCass} src={getLogoImage(name)} />;
}

export default ContextIcon;
