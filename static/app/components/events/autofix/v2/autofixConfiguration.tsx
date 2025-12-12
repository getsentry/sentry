import {Fragment, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import seerAutofixImg from 'sentry-images/autofix.png';
import seerConfigCheckImg from 'sentry-images/spot/seer-config-check.svg';
import seerConfigConnectImg from 'sentry-images/spot/seer-config-connect-2.svg';
import seerConfigMainImg from 'sentry-images/spot/seer-config-main.svg';
import seerConfigSeerImg from 'sentry-images/spot/seer-config-seer.svg';

import {Stack} from '@sentry/scraps/layout/stack';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {useGroupSummary} from 'sentry/components/group/groupSummary';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {IconSeer} from 'sentry/icons/iconSeer';
import {IconUpgrade} from 'sentry/icons/iconUpgrade';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {MarkedText} from 'sentry/utils/marked/markedText';
import useOrganization from 'sentry/utils/useOrganization';

export function AutofixConfigureQuota() {
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
              <LinkButton
                priority="primary"
                // TODO: point to correct product
                to="/settings/billing/overview/"
              >
                <Stack direction="row" gap="sm">
                  <IconUpgrade />
                  {t('Try Out Seer Now')}
                </Stack>
              </LinkButton>
            </Stack>
          </Stack>
        </MeetSeerPanel>
        <Stack width="70%" align="center">
          <ImageContainer width="250px" height="120px">
            <Image alignSelf="flex-start" src={seerAutofixImg} />
          </ImageContainer>
          <SeerFeaturesPanel width="100%">
            <Stack direction="row" gap="md" padding="md">
              <ImageContainer aspectRatio="16 / 9" minWidth="30px" width="10%">
                <Image src={seerConfigConnectImg} />
              </ImageContainer>
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
          <SeerFeaturesPanel width="100%">
            <Stack direction="row" gap="md" padding="md">
              <ImageContainer aspectRatio="16 / 9" minWidth="30px" width="10%">
                <Image src={seerConfigCheckImg} />
              </ImageContainer>
              <Stack gap="sm" padding="sm">
                <Heading as="h3">{t('AI Code Review')}</Heading>
                <Text>{t('Seer catches bugs in your PRs before you ship them.')}</Text>
              </Stack>
            </Stack>
          </SeerFeaturesPanel>
        </Stack>
      </Stack>
    </Fragment>
  );
}

interface AiSetupConfigureSeerProps {
  event: Event;
  group: Group;
  project: Project;
}

export function AutofixConfigureSeer({event, group, project}: AiSetupConfigureSeerProps) {
  const organization = useOrganization();
  const {data, isPending, isError} = useGroupSummary(group, event, project);

  return (
    <Fragment>
      <SeerFeaturesPanel width="100%">
        <Stack direction="row" gap="2xl" padding="2xl">
          <ImageContainer aspectRatio="16 / 9" maxWidth="150px" width="40%">
            <Image src={seerConfigSeerImg} />
          </ImageContainer>
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
        <AngledImageContainer>
          <Image src={seerAutofixImg} />
        </AngledImageContainer>
        <SeerPreviewPanel alignSelf="flex-start">
          <Stack gap="md" padding="md">
            <Heading as="h3">{t('What happened')}</Heading>
            {isPending ? (
              <Placeholder height="1rem" />
            ) : isError ? (
              <Stack gap="sm" direction="row">
                <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
                <Text>{t('Error loading what happened')}</Text>
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
                <Text>{t('Error loading initial guess')}</Text>
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

const ImageContainer = styled('div')<{
  aspectRatio?: CSSProperties['aspectRatio'];
  height?: CSSProperties['height'];
  maxWidth?: CSSProperties['maxWidth'];
  minWidth?: CSSProperties['maxWidth'];
  width?: CSSProperties['width'];
}>`
  display: flex;
  ${p => p.aspectRatio && `aspect-ratio: ${p.aspectRatio}`};
  ${p => p.height && `height: ${p.height}`};
  ${p => p.width && `width: ${p.width}`};
  ${p => p.minWidth && `min-width: ${p.minWidth}`};
  ${p => p.maxWidth && `max-width: ${p.maxWidth}`};
`;

const AngledImageContainer = styled('div')`
  position: absolute;
  right: -70px;
  width: 250px;
  height: 120px;
  transform: rotate(45deg); /* Rotates the image 45 degrees clockwise */
`;

const HeroImage = styled('img')`
  position: absolute;
  z-index: ${p => p.theme.zIndex.initial};
  min-width: 150%;
  left: 50%;
  transform: translateX(-47%) translateY(-35%);
`;

const Image = styled('img')<{alignSelf?: CSSProperties['alignSelf']}>`
  align-self: ${p => p.alignSelf ?? 'center'};
  justify-self: center;
  width: 100%;
`;

const SeerPreviewText = styled('div')`
  p {
    margin-bottom: 0;
  }
`;
