import {Fragment, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import seerConfigSeerImg from 'sentry-images/spot/seer-config-seer.svg';
import seerConfigShipImg from 'sentry-images/spot/seer-config-ship.svg';

import {Flex} from '@sentry/scraps/layout/flex';
import {Stack} from '@sentry/scraps/layout/stack';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Image} from 'sentry/components/core/image/image';
import {useGroupSummary} from 'sentry/components/group/groupSummary';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {IconSeer} from 'sentry/icons/iconSeer';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {MarkedText} from 'sentry/utils/marked/markedText';
import useOrganization from 'sentry/utils/useOrganization';
import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';

interface AutofixConfigureSeerProps {
  event: Event;
  group: Group;
  project: Project;
}

export function AutofixConfigureSeer({event, group, project}: AutofixConfigureSeerProps) {
  const organization = useOrganization();
  const seerOnboardingCheck = useSeerOnboardingCheck();
  const {data, isPending, isError} = useGroupSummary(group, event, project);

  const orgNeedsToConfigureSeer =
    // needs to enable autofix
    !seerOnboardingCheck.data?.isAutofixEnabled ||
    // catch all, ensure seer is configured
    !seerOnboardingCheck.data?.isSeerConfigured;

  return (
    <Fragment>
      <SeerFeaturesPanel width="100%">
        <Stack direction="row" gap="2xl" padding="2xl">
          <ImageContainer aspectRatio="16 / 9" maxWidth="150px" width="40%">
            <Image src={seerConfigSeerImg} alt="" />
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
          <Image src={seerConfigShipImg} alt="" />
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
              {orgNeedsToConfigureSeer ? (
                <LinkButton
                  priority="primary"
                  to={`/organizations/${organization.slug}/settings/seer/onboarding/`}
                  icon={<IconSeer />}
                >
                  {t('Set Up Seer')}
                </LinkButton>
              ) : (
                <LinkButton
                  priority="primary"
                  to={`/organizations/${organization.slug}/settings/projects/${project.slug}/seer/`}
                  icon={<IconSeer />}
                >
                  {t('Set Up Seer for This Project')}
                </LinkButton>
              )}
            </Stack>
          </Stack>
        </SeerPreviewPanel>
      </Stack>
    </Fragment>
  );
}

export const SeerFeaturesPanel = styled(Panel)<{width: CSSProperties['width']}>`
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

const AngledImageContainer = styled('div')`
  position: absolute;
  right: -50px;
  width: 250px;
  height: 120px;
  transform: rotate(45deg); /* Rotates the image 45 degrees clockwise */
`;

const SeerPreviewText = styled('div')`
  p {
    margin-bottom: 0;
  }
`;

export const ImageContainer = styled(Flex)<{
  aspectRatio?: CSSProperties['aspectRatio'];
}>`
  ${p => p.aspectRatio && `aspect-ratio: ${p.aspectRatio}`};
`;
