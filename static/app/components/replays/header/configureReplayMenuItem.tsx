import type {Key} from '@react-types/shared';
import {IconOpen} from '@sentry/icons/open';
import {IconSettings} from '@sentry/icons/settings';
import * as Sentry from '@sentry/react';

import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';

import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

export function useConfigureReplayMenuItem({
  isMobile,
  replayRecord,
}: {
  isMobile: boolean;
  replayRecord: ReplayRecord | undefined;
}): MenuItemProps {
  const organization = useOrganization();

  const items = isMobile ? getMobileItems(replayRecord) : getWebItems();

  return {
    key: 'configure-replay',
    label: t('Configure Replay'),
    leadingItems: <IconSettings variant="muted" />,
    submenu: true,
    children: items.map(item => ({
      ...item,
      onAction: () =>
        trackAnalytics('replay.details-resource-docs-clicked', {
          organization,
          title: keyToTitle(item.key),
        }),
    })),
  };
}

function getPath(sdkName: string) {
  switch (sdkName) {
    case 'sentry.cocoa':
      return 'apple/guides/ios'; // https://docs.sentry.io/platforms/apple/guides/ios/session-replay/
    case 'sentry.java.android':
      return 'android'; // https://docs.sentry.io/platforms/android/session-replay/
    case 'sentry.cocoa.flutter':
    case 'sentry.dart.flutter':
    case 'sentry.java.android.flutter':
      return 'flutter'; // https://docs.sentry.io/platforms/flutter/session-replay/
    case 'npm:@sentry/react-native':
    case 'sentry.cocoa.react-native':
    case 'sentry.javascript.react-native':
    case 'sentry.java.android.react-native':
      return 'react-native'; // https://docs.sentry.io/platforms/react-native/session-replay/
    case 'sentry.native.unreal':
    case 'sentry.native.xbox.unreal':
    case 'sentry.cocoa.unreal':
    case 'sentry.java.android.unreal':
      return 'unreal'; // https://docs.sentry.io/platforms/unreal/session-replay/
    case 'sentry.cocoa.kmp':
    case 'sentry.java.android.kmp':
      return 'kotlin/guides/kotlin-multiplatform'; // https://docs.sentry.io/platforms/kotlin/guides/kotlin-multiplatform/session-replay/
    case 'sentry.cocoa.capacitor':
    case 'sentry.java.android.capacitor':
      return 'javascript/guides/capacitor'; // https://docs.sentry.io/platforms/javascript/guides/capacitor/session-replay/
    case 'sentry.cocoa.dotnet':
    case 'sentry.java.android.dotnet':
      // .NET can record replays through the native SDKs but has no Session Replay docs to link to yet.
      return null;
    default:
      Sentry.captureMessage(`Unknown mobile platform in configure card: ${sdkName}`);
      return null;
  }
}

function keyToTitle(key: Key): string {
  switch (key) {
    case 'general':
      return t('General');
    case 'masking':
      return t('Element Masking/Blocking');
    case 'users':
      return t('Identify Users');
    case 'network':
      return t('Network Details');
    case 'canvas':
      return t('Canvas Support');
    default:
      return String(key);
  }
}

function getWebItems(): MenuItemProps[] {
  return [
    {
      key: 'general',
      label: keyToTitle('general'),
      details: t('Configure sampling rates and recording thresholds'),
      leadingItems: <IconOpen variant="muted" />,
      externalHref:
        'https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration',
    },
    {
      key: 'masking',
      label: keyToTitle('masking'),
      details: t('Unmask text (****) and unblock media (img, svg, video, etc.)'),
      leadingItems: <IconOpen variant="muted" />,
      externalHref:
        'https://docs.sentry.io/platforms/javascript/session-replay/privacy/#privacy-configuration',
    },
    {
      key: 'users',
      label: keyToTitle('users'),
      details: t('Identify your users through a specific attribute, such as email'),
      leadingItems: <IconOpen variant="muted" />,
      externalHref:
        'https://docs.sentry.io/platforms/javascript/session-replay/configuration/#identifying-users',
    },
    {
      key: 'network',
      label: keyToTitle('network'),
      details: t('Capture request and response headers or bodies'),
      leadingItems: <IconOpen variant="muted" />,
      externalHref:
        'https://docs.sentry.io/platforms/javascript/session-replay/configuration/#network-details',
    },
    {
      key: 'canvas',
      label: keyToTitle('canvas'),
      details: tct(
        'Opt-in to record HTML [code:canvas] elements, added in SDK version 7.98.0',
        {code: <code />}
      ),
      leadingItems: <IconOpen variant="muted" />,
      externalHref:
        'https://docs.sentry.io/platforms/javascript/session-replay/#canvas-recording',
    },
  ] satisfies MenuItemProps[];
}

function getMobileItems(replayRecord: ReplayRecord | undefined): MenuItemProps[] {
  const sdkName = replayRecord?.sdk.name;
  if (!sdkName) {
    // The SDK sent a replay without a name, so there is nothing for us to fix.
    // Prefixed because the SDK overwrites `sentry.sdk.*` and `sentry.replay_id`
    // with the viewer's own values.
    Sentry.logger.warn('Replay: Missing SDK name in configure card', {
      'replay_record.id': replayRecord?.id,
      'replay_record.platform': replayRecord?.platform,
      'replay_record.sdk.version': replayRecord?.sdk.version,
      'replay_record.os.name': replayRecord?.os.name,
    });
  }
  const path = sdkName ? getPath(sdkName) : null;

  return [
    {
      key: 'general',
      label: keyToTitle('general'),
      details: t('Configure sampling rates and recording thresholds'),
      leadingItems: <IconOpen variant="muted" />,
      externalHref: `https://docs.sentry.io/platforms/${path}/session-replay/#sampling`,
      disabled: !path,
    },
    {
      key: 'masking',
      label: keyToTitle('masking'),
      details: t('Unmask text (****) and unblock media (img, svg, video, etc.)'),
      leadingItems: <IconOpen variant="muted" />,
      externalHref: `https://docs.sentry.io/platforms/${path}/session-replay/#privacy`,
      disabled: !path,
    },
    {
      key: 'users',
      label: keyToTitle('users'),
      details: t('Identify your users through a specific attribute, such as email'),
      leadingItems: <IconOpen variant="muted" />,
      externalHref: `https://docs.sentry.io/platforms/${path}/enriching-events/identify-user/`,
      disabled: !path,
    },
  ] satisfies MenuItemProps[];
}
