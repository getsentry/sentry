import {Fragment} from 'react';
import styled from '@emotion/styled';

import onboardingInstall from 'sentry-images/spot/onboarding-install.svg';

import {usePrompt} from 'sentry/actionCreators/prompts';
import ButtonBar from 'sentry/components/buttonBar';
import {Button, LinkButton} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import FeatureFlagSettingsButton from 'sentry/components/events/featureFlags/featureFlagSettingsButton';
import {useFeatureFlagOnboarding} from 'sentry/components/events/featureFlags/useFeatureFlagOnboarding';
import {IconClose, IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
          >
            {t('Read More')}
          </LinkButton>
        </ActionButton>
      </BannerContent>
      <BannerIllustration src={onboardingInstall} alt="Install" />
    </Fragment>
  );
}

export default function FeatureFlagInlineCTA({projectId}: {projectId: string}) {
  const organization = useOrganization();
  const {activateSidebar} = useFeatureFlagOnboarding();

  function handleSetupButtonClick(e: any) {
    trackAnalytics('flags.setup_sidebar_opened', {
      organization,
      surface: 'issue_details.flags_section',
    });
    trackAnalytics('flags.cta_setup_button_clicked', {organization});
    activateSidebar(e);
  }

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
    <ButtonBar gap={1}>
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
        <FeatureFlagCTAContent handleSetupButtonClick={handleSetupButtonClick} />
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
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
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
  height: 100%;
  object-fit: contain;
  max-width: 30%;
  margin-right: 10px;
  margin-bottom: -${space(2)};
  padding: ${space(2)};
`;

export const BannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin: ${space(1)} 0;
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
