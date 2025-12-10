import {Fragment, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import seerConfigCheckImg from 'sentry-images/spot/seer-config-check.svg';
import seerConfigConnectImg from 'sentry-images/spot/seer-config-connect-2.svg';
import seerConfigMainImg from 'sentry-images/spot/seer-config-main.svg';
import seerConfigSeerImg from 'sentry-images/spot/seer-config-seer.svg';

import {Stack} from '@sentry/scraps/layout/stack';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {useSeerAcknowledgeMutation} from 'sentry/components/events/autofix/useSeerAcknowledgeMutation';
import {useGroupSummary} from 'sentry/components/group/groupSummary';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {IconSeer} from 'sentry/icons/iconSeer';
import {IconUpgrade} from 'sentry/icons/iconUpgrade';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {MarkedText} from 'sentry/utils/marked/markedText';
import useOrganization from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

import StartTrialButton from 'getsentry/components/startTrialButton';
import useSubscription from 'getsentry/hooks/useSubscription';
import type {ProductTrial} from 'getsentry/types';
import {getPotentialProductTrial} from 'getsentry/utils/billing';

interface AiSetupSeerIssueDetailsProps {
  event: Event;
  group: Group;
  project: Project;
}

export default function AiSetupSeerIssueDetails({
  event,
  group,
  project,
}: AiSetupSeerIssueDetailsProps) {
  const aiConfig = useAiConfig(group, project);

  const subscription = useSubscription();
  const trial = getPotentialProductTrial(
    subscription?.productTrials ?? null,
    DataCategory.SEER_AUTOFIX
  );

  if (!aiConfig.hasAutofixQuota) {
    if (trial && !trial.isStarted) {
      return <AiSetupSeerStartTrial trial={trial} />;
    }
    // TODO: no quota available but also can't start a trial
    return null;
  }

  return <AiSetupSeerConfiguration event={event} group={group} project={project} />;
}

interface AiSetupSeerStartTrialProps {
  trial: ProductTrial;
}

function AiSetupSeerStartTrial({trial}: AiSetupSeerStartTrialProps) {
  const organization = useOrganization();
  const autofixAcknowledgeMutation = useSeerAcknowledgeMutation();

  return (
    <Fragment>
      <HeroImage src={seerConfigMainImg} />
      <Stack align="center">
        <MeetSeerPanel>
          <Stack gap="2xl" padding="2xl">
            <Heading as="h2" size="2xl" align="center">
              {t('Meet Seer')}
            </Heading>
            <Text>
              {t(
                'Debug faster with Seer. It will connect to your repositories, scan all of your issues, highlight the ones that are quick to fix, and propose solutions. You can even integrate with your favorite coding agent to implement changes in code. '
              )}
            </Text>
            <Stack align="center">
              <StartTrialButton
                organization={organization}
                source="seer_drawer"
                requestData={{
                  productTrial: {
                    category: DataCategory.SEER_AUTOFIX,
                    reasonCode: trial?.reasonCode,
                  },
                }}
                busy={autofixAcknowledgeMutation.isPending}
                handleClick={() => autofixAcknowledgeMutation.mutate()}
                size="md"
                priority="primary"
                analyticsEventKey="seer_drawer.free_trial_clicked"
                analyticsEventName="Seer Drawer: Clicked Free Trial"
              >
                <Stack direction="row" gap="sm">
                  <IconUpgrade />
                  {t('Try Out Seer Now')}
                </Stack>
              </StartTrialButton>
            </Stack>
          </Stack>
        </MeetSeerPanel>
        <SeerFeaturesPanel width="50%">
          <Stack direction="row" gap="md" padding="md">
            <FeatureImage src={seerConfigConnectImg} minWidth="30px" width="10%" />
            <Stack gap="sm" padding="sm">
              <Heading as="h3">{t('Root Cause Analysis & Code Fixes')}</Heading>
              <Text>
                {t(
                  'Seer analyzes the root cause of an issue and propose fixes ready to merge as draft PRs.'
                )}
              </Text>
            </Stack>
          </Stack>
        </SeerFeaturesPanel>
        <SeerFeaturesPanel width="50%">
          <Stack direction="row" gap="md" padding="md">
            <FeatureImage src={seerConfigCheckImg} minWidth="30px" width="10%" />
            <Stack gap="sm" padding="sm">
              <Heading as="h3">{t('AI Code Review')}</Heading>
              <Text>{t('Seer catches bugs in your PRs before you ship them.')}</Text>
            </Stack>
          </Stack>
        </SeerFeaturesPanel>
      </Stack>
    </Fragment>
  );
}

interface AiSetupSeerConfigurationProps {
  event: Event;
  group: Group;
  project: Project;
}

function AiSetupSeerConfiguration({
  event,
  group,
  project,
}: AiSetupSeerConfigurationProps) {
  const organization = useOrganization();
  const {data, isPending, isError} = useGroupSummary(group, event, project);

  return (
    <Fragment>
      <SeerFeaturesPanel width="100%">
        <Stack direction="row" gap="2xl" padding="2xl">
          <FeatureImage src={seerConfigSeerImg} maxWidth="200px" width="40%" />
          <Stack gap="sm" padding="sm">
            <Heading as="h2" size="2xl">
              {t('Debug Faster with Seer')}
            </Heading>
            <Text>
              {t(
                'Seer connects to your repos, scans your issues, highlights quick fixes, and proposes solutions.'
              )}
            </Text>
            <Text>
              {t(
                'You can even integrate with your favorite agent to implement changes in code.'
              )}
            </Text>
          </Stack>
        </Stack>
      </SeerFeaturesPanel>
      <Stack>
        <SeerPreviewPanel alignSelf="flex-start">
          <Stack gap="md" padding="md">
            <Heading as="h3">{t('What happened')}</Heading>
            {isPending ? (
              <Placeholder height="1rem" />
            ) : isError ? (
              <Stack gap="sm" direction="row">
                <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
                <Text>{t('Error loading summary')}</Text>
              </Stack>
            ) : (
              data?.whatsWrong && (
                <SeerPreviewText>
                  <MarkedText text={data?.whatsWrong?.replace(/\*\*/g, '')} />
                </SeerPreviewText>
              )
            )}
          </Stack>
        </SeerPreviewPanel>
        <SeerPreviewPanel alignSelf="center">
          <Stack gap="md" padding="md">
            <Heading as="h3">{t('Initial Guess')}</Heading>
            {isPending ? (
              <Placeholder height="1rem" />
            ) : isError ? (
              <Stack gap="sm" direction="row">
                <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
                <Text>{t('Error loading summary')}</Text>
              </Stack>
            ) : (
              data?.possibleCause && (
                <SeerPreviewText>
                  <MarkedText text={data?.possibleCause?.replace(/\*\*/g, '')} />
                </SeerPreviewText>
              )
            )}
          </Stack>
        </SeerPreviewPanel>
        <SeerPreviewPanel alignSelf="flex-end">
          <Stack gap="md" padding="md">
            <Heading as="h3">{t('Next Steps')}</Heading>
            <Text>
              {t(
                'This is the initial analysis, but once Seer is configured you’ll be able to see a detailed breakdown of the issue’s root cause, a multi-step solution, and proposed code changes to fix it.'
              )}
            </Text>
            <Stack align="start">
              <LinkButton
                priority="primary"
                to={`/settings/${organization.slug}/seer/onboarding/`}
              >
                <Stack direction="row" gap="sm">
                  <IconSeer />
                  {t('Set Up Seer')}
                </Stack>
              </LinkButton>
            </Stack>
          </Stack>
        </SeerPreviewPanel>
      </Stack>
    </Fragment>
  );
}

interface FeatureImageProps {
  src: string;
  width: CSSProperties['width'];
  maxWidth?: CSSProperties['maxWidth'];
  minWidth?: CSSProperties['maxWidth'];
}

function FeatureImage({src, maxWidth, minWidth, width}: FeatureImageProps) {
  return (
    <StyledFeatureImageContainer maxWidth={maxWidth} minWidth={minWidth} width={width}>
      <StyledFeatureImage src={src} />
    </StyledFeatureImageContainer>
  );
}

const MeetSeerPanel = styled(Panel)`
  margin-top: 32%;
`;

const SeerFeaturesPanel = styled(Panel)<{width: CSSProperties['width']}>`
  width: ${p => p.width};
  min-width: ${p => p.width};
  max-width: ${p => p.width};
`;

const SeerPreviewPanel = styled(Panel)<{alignSelf: CSSProperties['alignSelf']}>`
  align-self: ${p => p.alignSelf};
  width: 70%;
  min-width: 70%;
  max-width: 70%;
`;

const StyledFeatureImageContainer = styled('div')<{
  width: CSSProperties['width'];
  maxWidth?: CSSProperties['maxWidth'];
  minWidth?: CSSProperties['maxWidth'];
}>`
  aspect-ratio: 16 / 9;
  width: ${p => p.width};
  min-width: ${p => p.minWidth ?? p.width};
  max-width: ${p => p.maxWidth ?? p.width};
`;

const HeroImage = styled('img')`
  position: absolute;
  z-index: ${p => p.theme.zIndex.initial};
  min-width: 150%;
  left: 50%;
  transform: translateX(-47%) translateY(-35%);
`;

const StyledFeatureImage = styled('img')`
  align-self: center;
  justify-self: center;
  width: 100%;
  height: 100%;
`;

const SeerPreviewText = styled('div')`
  p {
    margin-bottom: 0;
  }
`;
