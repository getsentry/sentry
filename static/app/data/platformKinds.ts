import type {PlatformKey} from 'sentry/types/project';

export type PlatformKind = 'language' | 'framework' | 'library' | 'platform';

// Platform kind is a display-oriented classification used by surfaces that
// need to label a platform (e.g. "React Native — Framework"). It does NOT
// match `PlatformIntegration.type`, which is misnamed in many entries and
// is also load-bearing for framework-suggestion gating.
//
// Only platforms whose `type` is incorrect for display are listed here.
// Everything else falls back to its `PlatformIntegration.type` value.
const overrides: Partial<Record<PlatformKey, PlatformKind>> = {
  android: 'platform',
  apple: 'platform',
  'apple-ios': 'platform',
  'apple-macos': 'platform',
  cordova: 'framework',
  dart: 'language',
  dotnet: 'platform',
  electron: 'framework',
  'nintendo-switch': 'platform',
  playstation: 'platform',
  'react-native': 'framework',
  xbox: 'platform',
};

const VALID_KINDS = new Set<PlatformKind>([
  'language',
  'framework',
  'library',
  'platform',
]);

export function getPlatformKind(key: PlatformKey, type: string): PlatformKind {
  const override = overrides[key];
  if (override) {
    return override;
  }
  return VALID_KINDS.has(type as PlatformKind) ? (type as PlatformKind) : 'language';
}
