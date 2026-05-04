import {useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EntryException, Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

const TOMBSTONES_DOCS_URL =
  'https://docs.sentry.io/platforms/android/configuration/tombstones/';

type TabConfig = {
  code: string;
  label: string;
  language: string;
  value: string;
};

type SdkConfig = {
  defaultTab: string;
  tabs: TabConfig[];
};

const ANDROID_SDK_CONFIG: SdkConfig = {
  defaultTab: 'manifest',
  tabs: [
    {
      label: 'AndroidManifest.xml',
      value: 'manifest',
      language: 'xml',
      code: `<!-- Requires sentry-android 8.35.0+ -->
<application>
  <meta-data
    android:name="io.sentry.tombstone.enable"
    android:value="true" />
</application>`,
    },
    {
      label: 'Kotlin',
      value: 'kotlin',
      language: 'kotlin',
      code: `// Requires sentry-android 8.35.0+
SentryAndroid.init(context) { options ->
  options.isTombstoneEnabled = true
}`,
    },
    {
      label: 'Java',
      value: 'java',
      language: 'java',
      code: `// Requires sentry-android 8.35.0+
SentryAndroid.init(context, options -> {
  options.setTombstoneEnabled(true);
});`,
    },
  ],
};

const REACT_NATIVE_SDK_CONFIG: SdkConfig = {
  defaultTab: 'javascript',
  tabs: [
    {
      label: 'JavaScript',
      value: 'javascript',
      language: 'javascript',
      code: `// Requires @sentry/react-native 8.5.0+
Sentry.init({
  enableTombstone: true,
});`,
    },
  ],
};

const FLUTTER_SDK_CONFIG: SdkConfig = {
  defaultTab: 'dart',
  tabs: [
    {
      label: 'Dart',
      value: 'dart',
      language: 'dart',
      code: `// Requires sentry_flutter 9.15.0+
await SentryFlutter.init(
  (options) {
    options.enableTombstone = true;
  },
);`,
    },
  ],
};

const SDK_CONFIGS: Record<string, SdkConfig> = {
  'sentry.native.android': ANDROID_SDK_CONFIG,
  'sentry.native.android.react-native': REACT_NATIVE_SDK_CONFIG,
  'sentry.native.android.flutter': FLUTTER_SDK_CONFIG,
};

function hasSignalHandlerMechanism(event: Event): boolean {
  const exceptionEntry = event.entries?.find(
    (entry): entry is EntryException => entry.type === EntryType.EXCEPTION
  );
  if (!exceptionEntry) {
    return false;
  }
  return (
    exceptionEntry.data.values?.some(
      (value: ExceptionValue) => value.mechanism?.type === 'signalhandler'
    ) ?? false
  );
}

function getSdkConfig(event: Event): SdkConfig | undefined {
  const sdkName = event.sdk?.name;
  if (!sdkName) {
    return undefined;
  }
  return SDK_CONFIGS[sdkName];
}

export function shouldShowTombstonesBanner(event: Event): boolean {
  return getSdkConfig(event) !== undefined && hasSignalHandlerMechanism(event);
}

interface Props {
  event: Event;
  projectId: string;
}

export function AndroidNativeTombstonesBanner({event, projectId}: Props) {
  const organization = useOrganization();
  const sdkConfig = getSdkConfig(event);
  const [codeTab, setCodeTab] = useState(sdkConfig?.defaultTab ?? 'manifest');

  const {isLoading, isError, isPromptDismissed, dismissPrompt, snoozePrompt} = usePrompt({
    feature: 'issue_android_tombstones_onboarding',
    organization,
    projectId,
    daysToSnooze: 7,
  });

  if (isLoading || isError || isPromptDismissed || !sdkConfig) {
    return null;
  }

  const activeTab =
    sdkConfig.tabs.find(tab => tab.value === codeTab) ?? sdkConfig.tabs[0]!;

  return (
    <BannerWrapper>
      <Flex direction="column" gap="md">
        <Heading as="h4">{t('Enable Tombstone Collection')}</Heading>
        <Text as="p" style={{maxWidth: 460}}>
          {t(
            'This native crash was captured via the Android NDK integration only. Enable Tombstone collection in your application to get richer crash reports with more context, including additional thread information, better stack traces and more.'
          )}
        </Text>
        <CodeBlock
          tabs={sdkConfig.tabs.map(tab => ({label: tab.label, value: tab.value}))}
          selectedTab={codeTab}
          onTabClick={setCodeTab}
          language={activeTab.language}
        >
          {activeTab.code}
        </CodeBlock>
        <LinkButton
          style={{alignSelf: 'flex-start'}}
          href={TOMBSTONES_DOCS_URL}
          external
          variant="primary"
          size="sm"
          analyticsEventName="Clicked Android Tombstones Onboarding CTA"
          analyticsEventKey="issue-details.android-tombstones-onboarding-cta-clicked"
          analyticsParams={{
            organization,
            sdk_name: event.sdk?.name ?? '',
          }}
        >
          {t('Learn More')}
        </LinkButton>
      </Flex>
      <CloseDropdownMenu
        position="bottom-end"
        triggerProps={{
          showChevron: false,
          priority: 'transparent',
          icon: <IconClose variant="muted" />,
        }}
        size="xs"
        items={[
          {
            key: 'dismiss',
            label: t('Dismiss'),
            onAction: () => {
              dismissPrompt();
              trackAnalytics('issue-details.android-tombstones-cta-dismiss', {
                organization,
                type: 'dismiss',
              });
            },
          },
          {
            key: 'snooze',
            label: t('Snooze'),
            onAction: () => {
              snoozePrompt();
              trackAnalytics('issue-details.android-tombstones-cta-dismiss', {
                organization,
                type: 'snooze',
              });
            },
          },
        ]}
      />
    </BannerWrapper>
  );
}

const BannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.xl};
  margin: ${p => p.theme.space.md} 0;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, ${p => p.theme.tokens.background.secondary} 0%, transparent) 0%,
    ${p => p.theme.tokens.background.secondary} 70%,
    ${p => p.theme.tokens.background.secondary} 100%
  );
`;

const CloseDropdownMenu = styled(DropdownMenu)`
  position: absolute;
  display: block;
  top: ${p => p.theme.space.md};
  right: ${p => p.theme.space.md};
  cursor: pointer;
  z-index: 1;
`;
