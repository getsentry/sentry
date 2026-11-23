import styled from '@emotion/styled';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {useQuery} from '@tanstack/react-query';
import type {Variants} from 'framer-motion';
import {motion} from 'framer-motion';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid, type GridProps} from '@sentry/scraps/layout';

import {CreateSampleEventButton} from 'sentry/components/onboarding/createSampleEventButton';
import {t} from 'sentry/locale';
import {pulsingIndicatorStyles} from 'sentry/styles/pulsingIndicator';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {findFirstIssue} from 'sentry/utils/useEventWaiter';
import {ONBOARDING_ENTER, ONBOARDING_STAGGER} from 'sentry/views/onboarding/animations';

import {GridFooter} from './genericFooter';

interface FirstEventFooterProps {
  onClickSetupLater: () => void;
  organization: Organization;
  project: Project;
  leading?: React.ReactNode;
}

export function FirstEventFooter({
  organization,
  project,
  onClickSetupLater,
  leading,
}: FirstEventFooterProps) {
  const {data: issues} = useQuery({
    ...apiOptions.as<Group[]>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/issues/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        staleTime: Infinity,
      }
    ),

    enabled: !!project.firstEvent,
  });

  const firstIssue =
    project.firstEvent && issues ? findFirstIssue(issues, project.firstEvent) : undefined;

  return (
    <GridFooter>
      <Flex align="center">{leading}</Flex>
      <Flex align="center" justify="center">
        {flexProps => (
          <motion.div
            {...flexProps}
            initial="initial"
            animate="animate"
            exit="exit"
            {...ONBOARDING_STAGGER}
          >
            {project.firstEvent ? (
              <IconCheckmark variant="success" />
            ) : (
              <WaitingIndicator variants={indicatorAnimation} />
            )}
            <AnimatedText
              errorReceived={!!project.firstEvent}
              variants={indicatorAnimation}
            >
              {project.firstEvent ? t('Error Received') : t('Waiting for error')}
            </AnimatedText>
          </motion.div>
        )}
      </Flex>
      <OnboardingButtonBar>
        {/* if hasn't sent first event, allow leaving without giving up on setup */}
        {project.firstEvent ? null : (
          // Phones lack the width for two actions; the header Skip covers them.
          <Container display={{zero: 'none', xs: 'block'}}>
            <Button variant="transparent" onClick={onClickSetupLater}>
              {t('Set up later')}
            </Button>
          </Container>
        )}
        {/* if hasn't sent first event, allow creation of sample error */}
        {project.firstEvent ? (
          <LinkButton
            onClick={() => {
              trackAnalytics('onboarding.scm_take_to_error_clicked', {
                organization,
                platform: project.platform,
              });
            }}
            to={
              firstIssue
                ? `/organizations/${organization.slug}/issues/${firstIssue.id}/?referrer=onboarding-first-event-footer`
                : `/organizations/${organization.slug}/issues/?project=${project.id}&referrer=onboarding-first-event-footer`
            }
            variant="primary"
          >
            {t('Take me to my error')}
          </LinkButton>
        ) : (
          <CreateSampleEventButton
            project={project}
            source="targeted-onboarding"
            variant="primary"
            hasScmOnboarding
          >
            {t('View Sample Error')}
          </CreateSampleEventButton>
        )}
      </OnboardingButtonBar>
    </GridFooter>
  );
}

function OnboardingButtonBar(props: GridProps) {
  return <Grid flow="column" align="center" gap="xl" justifySelf="end" {...props} />;
}

const AnimatedText = styled(motion.div, {
  shouldForwardProp: prop => prop !== 'errorReceived',
})<{errorReceived: boolean}>`
  margin-left: ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.md};
  color: ${p =>
    p.errorReceived ? p.theme.tokens.content.success : p.theme.colors.pink500};
`;

const indicatorAnimation: Variants = ONBOARDING_ENTER.variants;

const WaitingIndicator = styled(motion.div)`
  ${pulsingIndicatorStyles};
  background-color: ${p => p.theme.colors.pink400};
`;
