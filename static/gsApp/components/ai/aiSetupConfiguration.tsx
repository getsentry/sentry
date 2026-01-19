import {Fragment, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import seerConfigCheckImg from 'sentry-images/spot/seer-config-check.svg';
import seerConfigConnectImg from 'sentry-images/spot/seer-config-connect-2.svg';
import seerConfigMainImg from 'sentry-images/spot/seer-config-main.svg';
import seerConfigShipImg from 'sentry-images/spot/seer-config-ship.svg';

import {Alert} from '@sentry/scraps/alert/alert';
import {Stack} from '@sentry/scraps/layout/stack';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Image as ImageBase} from 'sentry/components/core/image/image';
import {
  AutofixConfigureSeer,
  ImageContainer,
  SeerFeaturesPanel,
} from 'sentry/components/events/autofix/v2/autofixConfigureSeer';
import Panel from 'sentry/components/panels/panel';
import {IconUpgrade} from 'sentry/icons/iconUpgrade';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

import useSubscription from 'getsentry/hooks/useSubscription';
import {hasAccessToSubscriptionOverview} from 'getsentry/utils/billing';

interface AiSetupConfigurationProps {
  event: Event;
  group: Group;
  project: Project;
}

export default function AiSetupConfiguration({
  event,
  group,
  project,
}: AiSetupConfigurationProps) {
  const organization = useOrganization();
  const aiConfig = useAiConfig(group, project);
  if (organization.features.includes('seer-billing') && !aiConfig.hasAutofixQuota) {
    return <AutofixConfigureQuota />;
  }
  return <AutofixConfigureSeer event={event} group={group} project={project} />;
}

function AutofixConfigureQuota() {
  const organization = useOrganization();
  const subscription = useSubscription();
  return (
    <Fragment>
      <HeroImage src={seerConfigMainImg} alt="" />
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
              {hasAccessToSubscriptionOverview(subscription, organization) ? (
                <LinkButton
                  to={`/settings/${organization.slug}/billing/overview/?product=seer`}
                  priority="primary"
                  icon={<IconUpgrade />}
                >
                  {t('Try Out Seer Now')}
                </LinkButton>
              ) : (
                <Alert variant="warning">
                  {t(
                    'You need to be a billing member to try out Seer. Please contact your organization owner to upgrade your plan.'
                  )}
                </Alert>
              )}
            </Stack>
          </Stack>
        </MeetSeerPanel>
        <Stack width="70%" align="center">
          <ImageContainer width="250px" height="120px">
            <Image alignSelf="flex-start" src={seerConfigShipImg} alt="" width="100%" />
          </ImageContainer>
          <SeerFeaturesPanel width="100%">
            <Stack direction="row" gap="md" padding="md">
              <ImageContainer aspectRatio="16 / 9" minWidth="30px" width="10%">
                <Image src={seerConfigConnectImg} alt="" />
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
                <Image src={seerConfigCheckImg} alt="" />
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

const HeroImage = styled(ImageBase)`
  position: absolute;
  z-index: ${p => p.theme.zIndex.initial};
  min-width: 150%;
  left: 50%;
  transform: translateX(-47%) translateY(-35%);
`;

const Image = styled(ImageBase)<{alignSelf?: CSSProperties['alignSelf']}>`
  align-self: ${p => p.alignSelf ?? 'center'};
`;

const MeetSeerPanel = styled(Panel)`
  margin-top: 32%;
`;
