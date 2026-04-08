import {useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EntryException, Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

const ANDROID_NATIVE_SDK_PREFIX = 'sentry.native.android';
const TOMBSTONES_DOCS_URL =
  'https://docs.sentry.io/platforms/android/configuration/tombstones/';

const CODE_SNIPPETS: Record<string, string> = {
  manifest: `<application>
  <meta-data
    android:name="io.sentry.tombstone.enable"
    android:value="true" />
</application>`,
  kotlin: `SentryAndroid.init(context) { options ->
  options.isReportHistoricalTombstones = true
}`,
  java: `SentryAndroid.init(context, options -> {
  options.setReportHistoricalTombstones(true);
});`,
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
      value => value.mechanism?.type === 'signalhandler'
    ) ?? false
  );
}

function isAndroidNativeSdk(event: Event): boolean {
  return event.sdk?.name?.startsWith(ANDROID_NATIVE_SDK_PREFIX) ?? false;
}

export function shouldShowTombstonesBanner(event: Event): boolean {
  return isAndroidNativeSdk(event) && hasSignalHandlerMechanism(event);
}

interface Props {
  event: Event;
  projectId: string;
}

export function AndroidNativeTombstonesBanner({event, projectId}: Props) {
  const organization = useOrganization();
  const [codeTab, setCodeTab] = useState('manifest');

  const {isLoading, isError, isPromptDismissed, dismissPrompt, snoozePrompt} = usePrompt({
    feature: 'issue_android_tombstones_onboarding',
    organization,
    projectId,
    daysToSnooze: 7,
  });

  if (isLoading || isError || isPromptDismissed) {
    return null;
  }

  return (
    <InterimSection type={SectionKey.EXCEPTION} title={t('Improve Native Crash Reports')}>
      <BannerWrapper>
        <div>
          <BannerTitle>{t('Enable Tombstone Collection')}</BannerTitle>
          <BannerDescription>
            {t(
              'This native crash was captured via the Android NDK integration only. Enable Tombstone collection in your application to get richer crash reports with more context, including additional thread information, better stack traces and more.'
            )}
          </BannerDescription>
          <CodeBlock
            tabs={[
              {label: 'AndroidManifest.xml', value: 'manifest'},
              {label: 'Kotlin', value: 'kotlin'},
              {label: 'Java', value: 'java'},
            ]}
            selectedTab={codeTab}
            onTabClick={setCodeTab}
            language={codeTab === 'manifest' ? 'xml' : codeTab}
          >
            {CODE_SNIPPETS[codeTab]}
          </CodeBlock>
          <LinkButton
            style={{marginTop: '12px'}}
            href={TOMBSTONES_DOCS_URL}
            external
            priority="primary"
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
        </div>
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
    </InterimSection>
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

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.font.size.xl};
  margin-bottom: ${p => p.theme.space.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const BannerDescription = styled('div')`
  margin-bottom: ${p => p.theme.space.lg};
  max-width: 460px;
`;

const CloseDropdownMenu = styled(DropdownMenu)`
  position: absolute;
  display: block;
  top: ${p => p.theme.space.md};
  right: ${p => p.theme.space.md};
  color: ${p => p.theme.colors.white};
  cursor: pointer;
  z-index: 1;
`;
