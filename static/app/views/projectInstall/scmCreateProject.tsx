import {Fragment, useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {Access} from 'sentry/components/acl/access';
import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

interface WizardState {
  // Flips true on the first meaningful action in section 1 (repo selected
  // or "Continue without a repo" clicked). Sections 2 and 3 reveal together
  // when this is true. Decoupled from selection state so later state edits
  // (de-selecting a repo) do not collapse the rest of the page.
  repoStepCompleted: boolean;
}

const INITIAL_STATE: WizardState = {
  repoStepCompleted: false,
};

export function ScmCreateProject() {
  // Session-storage backed so a refresh restores how far the user has
  // progressed. Separate key from new-org onboarding's 'onboarding' key.
  const [state, setState] = useSessionStorage('project-creation-wizard', INITIAL_STATE);
  const canUserCreateProject = useCanCreateProject();

  const completeRepoStep = useCallback(() => {
    setState(s => ({...s, repoStepCompleted: true}));
  }, [setState]);

  return (
    <SentryDocumentTitle title={t('Create a new project')}>
      <Access access={canUserCreateProject ? ['project:read'] : ['project:admin']}>
        <Stack flex={1} gap="2xl" padding="2xl">
          <Layout.Title withMargins>{t('Create a new project')}</Layout.Title>
          <Container maxWidth="760px">
            <Text as="p" variant="muted">
              {tct(
                'Set up a separate project for each part of your application (for example, your API server and frontend client), to quickly pinpoint which part of your application errors are coming from. [link: Read the docs].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/sentry-basics/integrate-frontend/create-new-project/" />
                  ),
                }
              )}
            </Text>
          </Container>

          <ConnectRepositorySection onComplete={completeRepoStep} />

          {state.repoStepCompleted && (
            <Fragment>
              <PlatformFeaturesSection />
              <ProjectDetailsSection />
            </Fragment>
          )}
        </Stack>
      </Access>
    </SentryDocumentTitle>
  );
}

// Placeholder for VDY-74. Will be replaced with <ScmConnect />.
function ConnectRepositorySection({onComplete}: {onComplete: () => void}) {
  return (
    <Stack gap="md">
      <Heading as="h2" size="xl">
        {t('Connect a repository')}
      </Heading>
      <Text variant="muted">{t('Connect step content goes here (VDY-74).')}</Text>
      <Button variant="primary" onClick={onComplete}>
        {t('Continue')}
      </Button>
    </Stack>
  );
}

// Placeholder for VDY-75. Will be replaced with <ScmPlatformFeatures />.
function PlatformFeaturesSection() {
  return (
    <Stack gap="md">
      <Heading as="h2" size="xl">
        {t('Platform & features')}
      </Heading>
      <Text variant="muted">
        {t('Platform and features step content goes here (VDY-75).')}
      </Text>
    </Stack>
  );
}

// Placeholder for VDY-76. Will be replaced with <ScmProjectDetails />.
function ProjectDetailsSection() {
  return (
    <Stack gap="md">
      <Heading as="h2" size="xl">
        {t('Project details')}
      </Heading>
      <Text variant="muted">{t('Project details step content goes here (VDY-76).')}</Text>
    </Stack>
  );
}
