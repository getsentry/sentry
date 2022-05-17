import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import Button from 'sentry/components/button';
import Card from 'sentry/components/card';
import Link from 'sentry/components/links/link';
import {IconChevron, IconClose, IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import space from 'sentry/styles/space';
import {OnboardingCustomComponentProps} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import testableTransition from 'sentry/utils/testableTransition';
import {onboardingIntegrations} from 'sentry/views/onboarding/targetedOnboarding/components/integrationSelect';

import SkipConfirm from './skipConfirm';

const MAX_INTEGRATIONS_COUNT = 3;
const onboardingIntegrationSet = new Map(onboardingIntegrations.map(i => [i.slug, i]));

export default function OnboardingIntegrationCard({
  organization,
  task,
  onboardingState,
  setOnboardingState,
}: OnboardingCustomComponentProps) {
  if (!onboardingState) {
    return null;
  }

  const handleSkip = () => {
    setOnboardingState &&
      setOnboardingState({
        ...onboardingState,
        selectedIntegrations: [],
      });
  };
  // Projects selected during onboarding but not received first event
  const finishedIntegrations = new Set(task.data?.providers ?? []);
  const integrationsToSetup = onboardingState.selectedIntegrations.filter(
    i => !finishedIntegrations.has(i)
  );
  if (integrationsToSetup.length === 0) {
    return null;
  }
  return (
    <TaskCard key="onboarding-integration-continue-card">
      <Title>{t('Integrations to Setup')}</Title>
      <OnboardingTaskProjectList>
        {integrationsToSetup.slice(0, MAX_INTEGRATIONS_COUNT).map(p => {
          const integration = onboardingIntegrationSet.get(p);
          return (
            <OnboardingTaskProjectListItem
              to={`/onboarding/${organization.slug}/setup-docs/?integration=${p}&sub_step=integration`}
              onClick={() => {
                trackAdvancedAnalyticsEvent(
                  'growth.onboarding_quick_start_cta_integration',
                  {
                    integration: p,
                    all_selected_integrations: integrationsToSetup.join(','),
                    organization,
                  }
                );
              }}
              key={p}
            >
              <OnboardingTaskProjectListItemInner>
                <PluginIcon pluginId={p} />
                {integration && integration.name}
                <StyledIconChevron direction="right" />
              </OnboardingTaskProjectListItemInner>
            </OnboardingTaskProjectListItem>
          );
        })}
        {integrationsToSetup.length > MAX_INTEGRATIONS_COUNT && (
          <OnboardingTaskProjectListItem
            onClick={() => {
              trackAdvancedAnalyticsEvent(
                'growth.onboarding_quick_start_cta_integration',
                {
                  organization,
                }
              );
            }}
            to={`/onboarding/${organization.slug}/setup-docs/?sub_step=integration`}
            key="more"
          >
            <OnboardingTaskProjectListItemInner>
              <StyledAndMoreIcon />
              {tct('and [num] more', {
                num: integrationsToSetup.length - MAX_INTEGRATIONS_COUNT,
              })}
            </OnboardingTaskProjectListItemInner>
          </OnboardingTaskProjectListItem>
        )}
      </OnboardingTaskProjectList>
      <SkipConfirm onSkip={handleSkip}>
        {({skip}) => (
          <CloseButton
            borderless
            size="zero"
            aria-label={t('Close')}
            icon={<IconClose size="xs" />}
            onClick={skip}
          />
        )}
      </SkipConfirm>
    </TaskCard>
  );
}

const Title = styled('div')`
  font-weight: 600;
  margin: ${space(2)} ${space(3)} 0;
`;

const TaskCard = styled(motion(Card))`
  position: relative;
  overflow: visible;
  display: flex;
  flex-direction: column;
  padding-bottom: ${space(1)};
`;
TaskCard.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  layout: true,
  variants: {
    initial: {
      opacity: 0,
      y: 40,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: testableTransition({
        delay: 0.8,
        when: 'beforeChildren',
        staggerChildren: 0.3,
      }),
    },
    exit: {
      y: 20,
      z: -10,
      opacity: 0,
      transition: {duration: 0.2},
    },
  },
};

const OnboardingTaskProjectList = styled('div')`
  display: flex;
  flex-direction: column;
`;

const StyledIconChevron = styled(IconChevron)``;

const OnboardingTaskProjectListItemInner = styled('div')`
  padding: ${space(1)} 0;

  display: flex;
  align-items: center;
  ${PluginIcon} {
    margin-right: ${space(1)};
  }
  ${StyledIconChevron} {
    margin-left: auto;
  }
`;
const OnboardingTaskProjectListItem = styled(Link)`
  :hover {
    background-color: ${p => p.theme.hover};
  }
  border-radius: 0;
  padding: 0 ${space(3)};
  color: ${p => p.theme.textColor};

  :not(:last-child) {
    ${OnboardingTaskProjectListItemInner} {
      border-bottom: 1px solid ${p => p.theme.innerBorder};
    }
  }
`;

const CloseButton = styled(Button)`
  position: absolute;
  right: ${space(1.5)};
  top: ${space(1.5)};
  color: ${p => p.theme.gray300};
`;
const StyledAndMoreIcon = styled(IconEllipsis)`
  margin-right: ${space(1)};
`;
