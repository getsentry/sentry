import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getSeerOnboardingCheckQueryOptions} from 'sentry/utils/getSeerOnboardingCheckQueryOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

type AutofixSetupType = 'organization' | 'project';

/**
 * Works out whether Seer still has to be connected to code before Autofix is
 * worth running, and at which level. Shared so every Autofix surface asks the
 * same question the same way.
 */
export function useAutofixSetupStep({seerReposLinked}: {seerReposLinked: boolean}) {
  const organization = useOrganization();
  const {
    data: setupCheck,
    isPending,
    isError,
  } = useQuery(getSeerOnboardingCheckQueryOptions({organization}));

  const needOrgSetup = !setupCheck?.hasSupportedScmIntegration;
  const needProjSetup = !seerReposLinked;

  // Legacy Seer plans are allowed to run Autofix without the SCM integration.
  const isLegacySeerPlan = organization.features.includes('seer-added');

  let setupType: AutofixSetupType | null = null;
  if (!isLegacySeerPlan) {
    if (needOrgSetup) {
      setupType = 'organization';
    } else if (needProjSetup) {
      setupType = 'project';
    }
  }

  return {
    isPending,
    isError,
    needOrgSetup,
    needProjSetup,
    setupType,
  };
}

interface AutofixSetupCardProps {
  group: Group;
  project: Project;
  setupType: AutofixSetupType;
}

export function AutofixSetupCard({group, project, setupType}: AutofixSetupCardProps) {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea() || 'seer';

  const analyticsProps = {
    analyticsEventKey: `${analyticsArea}.seer_setup_clicked`,
    analyticsEventName:
      analyticsArea === 'issue_inbox'
        ? 'Issue Inbox: Seer Setup Clicked'
        : 'Seer: Setup Clicked',
    analyticsParams: {group_id: group.id, setup_type: setupType},
  };

  return (
    <Stack
      border="muted"
      radius="md"
      padding="lg"
      gap="lg"
      data-test-id="autofix-setup-card"
    >
      <Text bold>{t('Finish Configuring Seer')}</Text>
      <Text>
        {t(
          'Your organization has access to Seer, which will allow you to run Autofix on your issues, but you aren’t getting the most out of it.'
        )}
      </Text>
      <Text>{t('Autofix can:')}</Text>
      <Container as="ol" margin="0">
        <li>{t('Determine the root cause of your issue and how to reproduce it')}</li>
        <li>{t('Propose a solution')}</li>
        <li>{t('Create a code fix')}</li>
      </Container>
      <Flex>
        {setupType === 'organization' ? (
          <LinkButton
            to={`/settings/${organization.slug}/seer/onboarding/`}
            icon={<IconSeer />}
            {...analyticsProps}
          >
            {t('Set Up Seer')}
          </LinkButton>
        ) : (
          <LinkButton
            to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
            icon={<IconSeer />}
            {...analyticsProps}
          >
            {t('Set Up Seer for This Project')}
          </LinkButton>
        )}
      </Flex>
    </Stack>
  );
}
