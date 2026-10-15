import {css} from '@emotion/react';
import {IconChevron} from '@sentry/icons/chevron';
import {IconOpen} from '@sentry/icons/open';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {OnboardingSkipReason} from 'sentry/utils/analytics/onboardingAnalyticsEvents';
import type {OnboardingStepId} from 'sentry/views/onboarding/types';

interface OnboardingSkipModalProps extends ModalRenderProps {
  onConfirm: (reason: OnboardingSkipReason) => void;
  step: OnboardingStepId;
}

function OnboardingSkipModal({
  Body,
  CloseButton,
  closeModal,
  onConfirm,
  step,
}: OnboardingSkipModalProps) {
  const reasons: Array<{
    description: string;
    label: string;
    value: OnboardingSkipReason;
  }> = [
    {
      value: 'stuck',
      label: t('I got stuck'),
      description: t("Something didn't work, or I couldn't figure out the next step."),
    },
    {
      value: 'delegated',
      label: t("I'm going to make someone else do this"),
      description: t("Setup is going on someone else's to-do list."),
    },
    {
      value: 'no_time',
      label: t("I don't have time to do this right now"),
      description: t("I'll come back when I have a few minutes."),
    },
    {
      value: 'docs',
      label: t("I'll read the docs myself"),
      description: t('I prefer to set things up at my own pace.'),
    },
    {
      value: 'just_skip',
      label: t('Just let me outta here okay'),
      description: t(
        'Feeling trapped in this linear setup flow? We get it, not trying to hold you hostage!'
      ),
    },
  ];

  const handleSkip = (reason: OnboardingSkipReason) => {
    closeModal();
    onConfirm(reason);
  };

  return (
    <Body>
      <Stack gap="2xl" paddingBottom="xl">
        <Stack gap="md">
          <Flex justify="between" align="center" gap="md">
            <Heading as="h2" size="lg">
              {t('Skipping ahead?')}
            </Heading>
            <CloseButton />
          </Flex>
          <Text>
            {t(
              'Let us know what was missing so we can fix it. Save the next dev a few WTFs'
            )}
          </Text>
        </Stack>
        <Alert
          variant="info"
          showIcon={false}
          css={css`
            /* Modal widths fall below the alert's breakpoint for inline actions. */
            > div:last-child {
              grid-area: auto;
              align-self: center;
            }
          `}
          trailingItems={
            <LinkButton
              href="https://sandbox.sentry.io"
              external
              icon={<IconOpen />}
              size="xs"
              variant="primary"
              analyticsEventKey="growth.clicked_enter_sandbox"
              analyticsEventName="Growth: Clicked Enter Sandbox"
              analyticsParams={{source: 'onboarding_skip', step}}
            >
              {t('Explore Sandbox')}
            </LinkButton>
          }
        >
          {t('Want to check out how Sentry works first?')}
        </Alert>
      </Stack>
      <Stack gap="lg">
        <Heading as="h4" size="md">
          {t('Select an option to skip')}
        </Heading>
        <Stack
          border="primary"
          radius="md"
          overflow="hidden"
          role="group"
          aria-label={t('Why are you skipping?')}
        >
          {reasons.map((option, index) => (
            <Container
              key={option.value}
              position="relative"
              borderBottom={index < reasons.length - 1 ? 'primary' : undefined}
            >
              <Container
                position="absolute"
                inset="0"
                width="100%"
                height="100%"
                radius="0"
              >
                {buttonProps => (
                  <Button
                    {...buttonProps}
                    variant="transparent"
                    aria-label={option.label}
                    onClick={() => handleSkip(option.value)}
                  />
                )}
              </Container>
              <Flex
                align="center"
                gap="xl"
                padding="xl"
                position="relative"
                pointerEvents="none"
              >
                <Stack gap="sm" flex="1">
                  <Text size="lg">{option.label}</Text>
                  <Text size="sm" variant="muted">
                    {option.description}
                  </Text>
                </Stack>
                <IconChevron direction="right" size="sm" variant="muted" aria-hidden />
              </Flex>
            </Container>
          ))}
        </Stack>
      </Stack>
      <Stack gap="md" paddingTop="xl">
        <Container alignSelf="start">
          <FeedbackButton
            variant="link"
            size="zero"
            icon={null}
            onClick={closeModal}
            analyticsEventKey="onboarding.skip_feedback_clicked"
            analyticsEventName="Onboarding: Skip Feedback Clicked"
            analyticsParams={{step}}
            feedbackOptions={{
              formTitle: t('Give feedback on onboarding'),
              messagePlaceholder: t('What was missing or got in your way during setup?'),
              tags: {'feedback.source': 'onboarding_skip'},
            }}
          >
            <Text size="sm" variant="muted" wrap="normal" align="left">
              {t('Something else? Love giving feedback? Click here!')}
            </Text>
          </FeedbackButton>
        </Container>
      </Stack>
    </Body>
  );
}

export function openOnboardingSkipModal({
  organization,
  step,
  onSkip,
}: {
  onSkip: () => void;
  organization: Organization;
  step: OnboardingStepId;
}) {
  openModal(modalProps => (
    <OnboardingSkipModal
      {...modalProps}
      step={step}
      onConfirm={reason => {
        trackAnalytics('onboarding.skip_reason_submitted', {
          organization,
          step,
          reason,
        });
        onSkip();
      }}
    />
  ));
}
