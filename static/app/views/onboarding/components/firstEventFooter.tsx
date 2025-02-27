import {useCallback} from 'react';
import styled from '@emotion/styled';
import type {Variants} from 'framer-motion';
import {motion} from 'framer-motion';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Link from 'sentry/components/links/link';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import CreateSampleEventButton from 'sentry/views/onboarding/createSampleEventButton';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

import GenericFooter from './genericFooter';

interface FirstEventFooterProps {
  isLast: boolean;
  onClickSetupLater: () => void;
  organization: Organization;
  project: Project;
}

export default function FirstEventFooter({
  organization,
  project,
  onClickSetupLater,
  isLast,
}: FirstEventFooterProps) {
  const {activateSidebar} = useOnboardingSidebar();

  const {data: issues} = useApiQuery<Group[]>(
    [`/projects/${organization.slug}/${project.slug}/issues/`],
    {
      staleTime: Infinity,
      enabled: !!project.firstEvent,
    }
  );

  const firstIssue =
    !!project.firstEvent && issues
      ? issues.find((issue: Group) => issue.firstSeen === project.firstEvent)
      : undefined;

  const source = 'targeted_onboarding_first_event_footer';

  const getSecondaryCta = useCallback(() => {
    // if hasn't sent first event, allow skiping.
    // if last, no secondary cta
    if (!project?.firstEvent && !isLast) {
      return <Button onClick={onClickSetupLater}>{t('Next Platform')}</Button>;
    }
    return null;
  }, [project?.firstEvent, isLast, onClickSetupLater]);

  const getPrimaryCta = useCallback(() => {
    // if hasn't sent first event, allow creation of sample error
    if (!project?.firstEvent) {
      return (
        <CreateSampleEventButton
          project={project}
          source="targeted-onboarding"
          priority="primary"
        >
          {t('View Sample Error')}
        </CreateSampleEventButton>
      );
    }
    return (
      <LinkButton
        onClick={() =>
          trackAnalytics('growth.onboarding_take_to_error', {
            organization: project.organization,
            platform: project.platform,
          })
        }
        to={`/organizations/${organization.slug}/issues/${
          firstIssue && 'id' in firstIssue ? `${firstIssue.id}/` : ''
        }?referrer=onboarding-first-event-footer`}
        priority="primary"
      >
        {t('Take me to my error')}
      </LinkButton>
    );
  }, [project, organization.slug, firstIssue]);

  return (
    <GridFooter>
      <SkipOnboardingLink
        onClick={() => {
          trackAnalytics('growth.onboarding_clicked_skip', {
            organization,
            source,
          });
          activateSidebar({
            userClicked: false,
            source: 'targeted_onboarding_first_event_footer_skip',
          });
        }}
        to={`/organizations/${organization.slug}/issues/?referrer=onboarding-first-event-footer-skip`}
      >
        {t('Skip Onboarding')}
      </SkipOnboardingLink>
      <StatusWrapper
        initial="initial"
        animate="animate"
        exit="exit"
        variants={{
          initial: {opacity: 0, y: -10},
          animate: {
            opacity: 1,
            y: 0,
            transition: testableTransition({
              when: 'beforeChildren',
              staggerChildren: 0.35,
            }),
          },
          exit: {opacity: 0, y: 10},
        }}
      >
        {project?.firstEvent ? (
          <IconCheckmark isCircled color="green400" />
        ) : (
          <WaitingIndicator
            variants={indicatorAnimation}
            transition={testableTransition()}
          />
        )}
        <AnimatedText
          errorReceived={!!project?.firstEvent}
          variants={indicatorAnimation}
          transition={testableTransition()}
        >
          {project?.firstEvent ? t('Error Received') : t('Waiting for error')}
        </AnimatedText>
      </StatusWrapper>
      <OnboardingButtonBar gap={2}>
        {getSecondaryCta()}
        {getPrimaryCta()}
      </OnboardingButtonBar>
    </GridFooter>
  );
}

const OnboardingButtonBar = styled(ButtonBar)`
  margin: ${space(2)} ${space(4)};
  justify-self: end;
  margin-left: auto;
`;

const AnimatedText = styled(motion.div, {
  shouldForwardProp: prop => prop !== 'errorReceived',
})<{errorReceived: boolean}>`
  margin-left: ${space(1)};
  color: ${p => (p.errorReceived ? p.theme.successText : p.theme.pink400)};
`;

const indicatorAnimation: Variants = {
  initial: {opacity: 0, y: -10},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
};

const WaitingIndicator = styled(motion.div)`
  ${pulsingIndicatorStyles};
  background-color: ${p => p.theme.pink300};
`;

const StatusWrapper = styled(motion.div)`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  justify-content: center;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const SkipOnboardingLink = styled(Link)`
  margin: auto ${space(4)};
  white-space: nowrap;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const GridFooter = styled(GenericFooter)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    flex-direction: row;
    justify-content: end;
  }
`;
