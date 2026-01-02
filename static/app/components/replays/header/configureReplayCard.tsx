import type {ReactNode} from 'react';
import styled from '@emotion/styled';
import type {Key} from '@react-types/shared';
import * as Sentry from '@sentry/react';

import {Flex} from 'sentry/components/core/layout';
import DropdownButton from 'sentry/components/dropdownButton';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

export default function ConfigureReplayCard({
  isMobile,
  replayRecord,
}: {
  isMobile: boolean;
  replayRecord: ReplayRecord | undefined;
}) {
  const organization = useOrganization();

  return (
    <DropdownMenu
      onAction={key => {
        trackAnalytics('replay.details-resource-docs-clicked', {
          organization,
          title: keyToTitle(key),
        });
      }}
      items={isMobile ? getMobileItems(replayRecord) : getWebItems()}
      trigger={(triggerProps, isOpen) => (
        <DropdownButton {...triggerProps} isOpen={isOpen} size="xs">
          {t('Configure Replay')}
        </DropdownButton>
      )}
    />
  );
}

function getPath(sdkName: string | null | undefined) {
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
      label: (
        <ReplayConfigureDropdownItem
          title={keyToTitle('general')}
          subTitle={t('Configure sampling rates and recording thresholds')}
        />
      ),
      textValue: keyToTitle('general'),
      externalHref: `https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration`,
    },
    {
      key: 'masking',
      label: (
        <ReplayConfigureDropdownItem
          title={keyToTitle('masking')}
          subTitle={t('Unmask text (****) and unblock media (img, svg, video, etc.)')}
        />
      ),
      textValue: keyToTitle('masking'),
      externalHref: `https://docs.sentry.io/platforms/javascript/session-replay/privacy/#privacy-configuration`,
    },
    {
      key: 'users',
      label: (
        <ReplayConfigureDropdownItem
          title={keyToTitle('users')}
          subTitle={t('Identify your users through a specific attribute, such as email')}
        />
      ),
      textValue: keyToTitle('users'),
      externalHref: `https://docs.sentry.io/platforms/javascript/session-replay/configuration/#identifying-users`,
    },
    {
      key: 'network',
      label: (
        <ReplayConfigureDropdownItem
          title={keyToTitle('network')}
          subTitle={t('Capture request and response headers or bodies')}
        />
      ),
      textValue: keyToTitle('network'),
      externalHref: `https://docs.sentry.io/platforms/javascript/session-replay/configuration/#network-details`,
    },
    {
      key: 'canvas',
      label: (
        <ReplayConfigureDropdownItem
          title={keyToTitle('canvas')}
          subTitle={tct(
            'Opt-in to record HTML [code:canvas] elements, added in SDK version 7.98.0',
            {code: <code />}
          )}
        />
      ),
      textValue: keyToTitle('canvas'),
      externalHref: `https://docs.sentry.io/platforms/javascript/session-replay/#canvas-recording`,
    },
  ] satisfies MenuItemProps[];
}

function getMobileItems(replayRecord: ReplayRecord | undefined): MenuItemProps[] {
  const path = getPath(replayRecord?.sdk.name);

  return [
    {
      key: 'general',
      label: (
        <ReplayConfigureDropdownItem
          title={t('General')}
          subTitle={t('Configure sampling rates and recording thresholds')}
        />
      ),
      textValue: keyToTitle('general'),
      externalHref: `https://docs.sentry.io/platforms/${path}/session-replay/#sampling`,
      disabled: !path,
    },
    {
      key: 'masking',
      label: (
        <ReplayConfigureDropdownItem
          title={t('Element Masking/Blocking')}
          subTitle={t('Unmask text (****) and unblock media (img, svg, video, etc.)')}
        />
      ),
      textValue: keyToTitle('masking'),
      externalHref: `https://docs.sentry.io/platforms/${path}/session-replay/#privacy`,
      disabled: !path,
    },
    {
      key: 'users',
      label: (
        <ReplayConfigureDropdownItem
          title={t('Identify Users')}
          subTitle={t('Identify your users through a specific attribute, such as email')}
        />
      ),
      textValue: keyToTitle('users'),
      externalHref: `https://docs.sentry.io/platforms/${path}/enriching-events/identify-user/`,
      disabled: !path,
    },
  ] satisfies MenuItemProps[];
}

function ReplayConfigureDropdownItem({
  title,
  subTitle,
}: {
  subTitle: ReactNode;
  title: ReactNode;
}) {
  return (
    <Flex gap="md" align="center">
      <IconOpen />
      <ButtonContent>
        <ButtonTitle>{title}</ButtonTitle>
        <ButtonSubtitle>{subTitle}</ButtonSubtitle>
      </ButtonContent>
    </Flex>
  );
}

const ButtonContent = styled('div')`
  display: flex;
  flex-direction: column;
  text-align: left;
  white-space: pre-line;
  gap: ${space(0.25)};
`;

const ButtonTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const ButtonSubtitle = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
`;
