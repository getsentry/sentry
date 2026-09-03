import type {Key} from '@react-types/shared';
import * as Sentry from '@sentry/react';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconOpen, IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

/**
 * The "Configure Replay" entry of the page-title menu: a submenu of links into
 * the Session Replay docs for the SDK that recorded this replay. Mobile SDKs
 * have their own guides, so the link set depends on the platform; an SDK we
 * have no guide for renders the items disabled rather than linking nowhere.
 */
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
    // Tracking lives on each link rather than the menu's `onAction`, which
    // fires for every sibling action once this shares a menu with them.
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

function getPath(sdkName: string | null | undefined) {
  switch (sdkName) {
    case 'sentry.cocoa':
    case 'sentry.cocoa.unreal': // Session Replay on iOS builds of Unreal Engine games via the embedded Cocoa SDK
      return 'apple/guides/ios'; // https://docs.sentry.io/platforms/apple/guides/ios/session-replay/
    case 'sentry.java.android':
    case 'sentry.java.android.unreal': // Session Replay on Android builds of Unreal Engine games via the embedded Java Android SDK
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
  const path = getPath(replayRecord?.sdk.name);

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
