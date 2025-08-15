import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import onboardingInstall from 'sentry-images/spot/onboarding-install.svg';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import FeatureFlagSettingsButton from 'sentry/components/events/featureFlags/featureFlagSettingsButton';
import {useFeatureFlagOnboarding} from 'sentry/components/events/featureFlags/onboarding/useFeatureFlagOnboarding';
import {IconClose, IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export function FeatureFlagCTAContent({
  handleSetupButtonClick,
}: {
  handleSetupButtonClick: (e: any) => void;
}) {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();

  useEffect(() => {
    trackAnalytics('flags.cta_rendered', {
      organization,
      surface: analyticsArea,
    });
  }, [organization, analyticsArea]);

  return (
    <Fragment>
      <BannerContent>
        <BannerTitle>{t('Set Up Feature Flags')}</BannerTitle>
        <BannerDescription>
          {t(
            'Want to know which feature flags were associated with this issue? Set up your feature flag integration.'
          )}
        </BannerDescription>
        <ActionButton>
          <Button onClick={handleSetupButtonClick} priority="primary">
            {t('Set Up Now')}
          </Button>
          <LinkButton
            priority="default"
            href="https://docs.sentry.io/product/explore/feature-flags/"
            external
            onClick={() => {
              trackAnalytics('flags.cta_read_more_clicked', {
                organization,
                surface: analyticsArea,
              });
            }}
          >
            {t('Read More')}
          </LinkButton>
        </ActionButton>
      </BannerContent>
      <BannerIllustration src={onboardingInstall} alt="" />
    </Fragment>
  );
}

export default function FeatureFlagInlineCTA({
  projectId,
  projectPlatform,
}: {
  projectId: string;
  projectPlatform?: PlatformKey;
}) {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();

  const {activateSidebar} = useFeatureFlagOnboarding({projectPlatform});

  const {isLoading, isError, isPromptDismissed, dismissPrompt, snoozePrompt} = usePrompt({
    feature: 'issue_feature_flags_inline_onboarding',
    organization,
    projectId,
    daysToSnooze: 7,
  });

  const openForm = useFeedbackForm();
  const feedbackButton = openForm ? (
    <Button
      aria-label={t('Give feedback on the feature flag section')}
      icon={<IconMegaphone />}
      size={'xs'}
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we make feature flags work better for you?'),
          tags: {
            ['feedback.source']: 'issue_details_feature_flags',
            ['feedback.owner']: 'replay',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  ) : null;

  if (isLoading || isError || isPromptDismissed) {
    return null;
  }

  const actions = (
    <ButtonBar>
      {feedbackButton}
      <FeatureFlagSettingsButton orgSlug={organization.slug} />
    </ButtonBar>
  );

  return (
    <InterimSection
      help={t(
        "The last 100 flags evaluated in the user's session leading up to this event."
      )}
      isHelpHoverable
      title={t('Feature Flags')}
      type={SectionKey.FEATURE_FLAGS}
      actions={actions}
    >
      <BannerWrapper>
        <FeatureFlagCTAContent handleSetupButtonClick={activateSidebar} />
        <CloseDropdownMenu
          position="bottom-end"
          triggerProps={{
            showChevron: false,
            borderless: true,
            icon: <IconClose color="subText" />,
          }}
          size="xs"
          items={[
            {
              key: 'dismiss',
              label: t('Dismiss'),
              onAction: () => {
                dismissPrompt();
                trackAnalytics('flags.cta_dismissed', {
                  organization,
                  type: 'dismiss',
                  surface: analyticsArea,
                });
              },
            },
            {
              key: 'snooze',
              label: t('Snooze'),
              onAction: () => {
                snoozePrompt();
                trackAnalytics('flags.cta_dismissed', {
                  organization,
                  type: 'snooze',
                  surface: analyticsArea,
                });
              },
            },
          ]}
        />
      </BannerWrapper>
    </InterimSection>
  );
}

const ActionButton = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BannerDescription = styled('div')`
  margin-bottom: ${space(1.5)};
  max-width: 340px;
`;

const BannerContent = styled('div')`
  padding: ${space(2)};
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const BannerIllustration = styled('img')`
  object-fit: contain;
  max-width: 30%;
  min-width: 150px;
  padding-inline: ${space(2)};
  padding-top: ${space(2)};
  align-self: flex-end;
`;

export const BannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${space(1)};

  container-name: bannerWrapper;
  container-type: inline-size;

  @container bannerWrapper (max-width: 400px) {
    img {
      display: none;
    }
  }
`;

const CloseDropdownMenu = styled(DropdownMenu)`
  position: absolute;
  display: block;
  top: ${space(1)};
  right: ${space(1)};
  color: ${p => p.theme.white};
  cursor: pointer;
  z-index: 1;
`;
