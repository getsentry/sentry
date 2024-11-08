import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button} from 'sentry/components/button';
import {
  type AutofixSetupRepoDefinition,
  type AutofixSetupResponse,
  useAutofixSetup,
} from 'sentry/components/events/autofix/useAutofixSetup';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark, IconGithub} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

const ConsentStep = HookOrDefault({
  hookName: 'component:autofix-setup-step-consent',
  defaultComponent: null,
});

function AutofixIntegrationStep({autofixSetup}: {autofixSetup: AutofixSetupResponse}) {
  if (autofixSetup.integration.ok) {
    return (
      <Fragment>
        {tct('The GitHub integration is already installed, [link: view in settings].', {
          link: <ExternalLink href={`/settings/integrations/github/`} />,
        })}
        <GuidedSteps.StepButtons />
      </Fragment>
    );
  }

  if (autofixSetup.integration.reason === 'integration_inactive') {
    return (
      <Fragment>
        <p>
          {tct(
            'The GitHub integration has been installed but is not active. Navigate to the [integration settings page] and enable it to continue.',
            {
              link: <ExternalLink href={`/settings/integrations/github/`} />,
            }
          )}
        </p>
        <p>
          {tct(
            'Once enabled, come back to this page. For more information related to installing the GitHub integration, read the [link:documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/source-code-mgmt/github/" />
              ),
            }
          )}
        </p>
        <GuidedSteps.StepButtons />
      </Fragment>
    );
  }

  if (autofixSetup.integration.reason === 'integration_no_code_mappings') {
    return (
      <Fragment>
        <p>
          {tct(
            'You have an active GitHub installation, but no code mappings for this project. Add code mappings by visiting the [link:integration settings page] and editing your configuration.',
            {
              link: <ExternalLink href={`/settings/integrations/github/`} />,
            }
          )}
        </p>
        <p>
          {tct(
            'Once added, come back to this page. For more information related to installing the GitHub integration, read the [link:documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/source-code-mgmt/github/" />
              ),
            }
          )}
        </p>
        <GuidedSteps.StepButtons />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <p>
        {tct(
          'Install the GitHub integration by navigating to the [link:integration settings page] and clicking the "Install" button. Follow the steps provided.',
          {
            link: <ExternalLink href={`/settings/integrations/github/`} />,
          }
        )}
      </p>
      <p>
        {tct(
          'Once installed, come back to this page. For more information related to installing the GitHub integration, read the [link:documentation].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/integrations/source-code-mgmt/github/" />
            ),
          }
        )}
      </p>
      <GuidedSteps.StepButtons />
    </Fragment>
  );
}

export function GitRepoLink({repo}: {repo: AutofixSetupRepoDefinition}) {
  if (repo.provider === 'github' || repo.provider.split(':')[1] === 'github') {
    return (
      <RepoLinkItem>
        <GithubLink>
          <IconGithub size="sm" />
          <span>
            {repo.owner}/{repo.name}
          </span>
        </GithubLink>
        {repo.ok ? <IconCheckmark color="success" isCircled /> : null}
      </RepoLinkItem>
    );
  }

  return (
    <li>
      {repo.owner}/{repo.name}
    </li>
  );
}

function AutofixGithubIntegrationStep({
  autofixSetup,
  canStartAutofix,
  isLastStep,
  onSetupComplete,
}: {
  autofixSetup: AutofixSetupResponse;
  canStartAutofix: boolean;
  isLastStep?: boolean;
  onSetupComplete?: () => void;
}) {
  const sortedRepos = useMemo(
    () =>
      autofixSetup.githubWriteIntegration.repos.toSorted((a, b) => {
        if (a.ok === b.ok) {
          return `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`);
        }
        return a.ok ? -1 : 1;
      }),
    [autofixSetup.githubWriteIntegration.repos]
  );

  if (autofixSetup.githubWriteIntegration.ok) {
    return (
      <Fragment>
        <p>
          {tct(
            'The [link:Sentry Autofix GitHub App] has been installed on all required repositories:',
            {
              link: (
                <ExternalLink href="https://github.com/apps/sentry-autofix-experimental" />
              ),
            }
          )}
        </p>
        <RepoLinkUl>
          {sortedRepos.map(repo => (
            <GitRepoLink key={`${repo.owner}/${repo.name}`} repo={repo} />
          ))}
        </RepoLinkUl>
        <GuidedSteps.StepButtons>
          {isLastStep && (
            <Button
              priority="primary"
              size="sm"
              disabled={!canStartAutofix}
              onClick={onSetupComplete}
            >
              {t("Let's Go!")}
            </Button>
          )}
        </GuidedSteps.StepButtons>
      </Fragment>
    );
  }

  if (autofixSetup.githubWriteIntegration.repos.length > 0) {
    return (
      <Fragment>
        <p>
          {tct(
            'Install and grant write access to the [link:Sentry Autofix Github App] for the following repositories:',
            {
              link: (
                <ExternalLink
                  href={`https://github.com/apps/sentry-autofix/installations/new`}
                />
              ),
            }
          )}
        </p>
        <RepoLinkUl>
          {sortedRepos.map(repo => (
            <GitRepoLink key={`${repo.owner}/${repo.name}`} repo={repo} />
          ))}
        </RepoLinkUl>
        <p>
          {t(
            'Without this, Autofix can still provide root analysis and suggested code changes.'
          )}
        </p>
        <GuidedSteps.StepButtons>
          {isLastStep && (
            <Button
              priority="primary"
              size="sm"
              disabled={!canStartAutofix}
              onClick={onSetupComplete}
            >
              {t('Skip & Enable Autofix')}
            </Button>
          )}
        </GuidedSteps.StepButtons>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <p>
        {tct(
          'Install and grant write access to the [link:Sentry Autofix Github App] for the relevant repositories.',
          {
            link: (
              <ExternalLink
                href={`https://github.com/apps/sentry-autofix/installations/new`}
              />
            ),
          }
        )}
      </p>
      <p>
        {t(
          'Without this, Autofix can still provide root analysis and suggested code changes.'
        )}
      </p>
      <GuidedSteps.StepButtons>
        {isLastStep && (
          <Button
            priority="primary"
            size="sm"
            disabled={!canStartAutofix}
            onClick={onSetupComplete}
          >
            {t('Skip & Enable Autofix')}
          </Button>
        )}
      </GuidedSteps.StepButtons>
    </Fragment>
  );
}

function AutofixSetupSteps({
  autofixSetup,
  canStartAutofix,
  onSetupComplete,
}: {
  autofixSetup: AutofixSetupResponse;
  canStartAutofix: boolean;
  groupId: string;
  projectId: string;
  onSetupComplete?: () => void;
}) {
  return (
    <GuidedSteps>
      <ConsentStep hasConsented={autofixSetup.genAIConsent.ok} />
      <GuidedSteps.Step
        stepKey="integration"
        title={t('Install the GitHub Integration')}
        isCompleted={autofixSetup.integration.ok}
      >
        <AutofixIntegrationStep autofixSetup={autofixSetup} />
      </GuidedSteps.Step>
      <GuidedSteps.Step
        stepKey="repoWriteAccess"
        title={t('Allow Autofix to Make Pull Requests')}
        isCompleted={autofixSetup.githubWriteIntegration.ok}
        optional
      >
        <AutofixGithubIntegrationStep
          autofixSetup={autofixSetup}
          canStartAutofix={canStartAutofix}
          isLastStep
          onSetupComplete={onSetupComplete}
        />
      </GuidedSteps.Step>
    </GuidedSteps>
  );
}

export function AutofixSetupContent({
  projectId,
  groupId,
  onSetupComplete,
}: {
  groupId: string;
  projectId: string;
  onSetupComplete?: () => void;
}) {
  const organization = useOrganization();
  const {data, canStartAutofix, isPending, isError, refetch} = useAutofixSetup(
    {groupId},
    {refetchOnWindowFocus: true}
  );

  const handleSetupComplete = async () => {
    await refetch();
    onSetupComplete?.();
  };

  useEffect(() => {
    if (!data) {
      return;
    }

    trackAnalytics('autofix.setup_content_viewed', {
      groupId,
      projectId,
      organization,
      setup_gen_ai_consent: data.genAIConsent.ok,
      setup_integration: data.integration.ok,
      setup_write_integration: data.githubWriteIntegration.ok,
    });
  }, [data, groupId, organization, projectId]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError message={t('Failed to fetch Autofix setup progress.')} />;
  }

  return (
    <SetupContainer>
      <Row>
        <Title>{t('Set up Autofix')}</Title>
        <FeatureBadge
          type="beta"
          title={tct(
            'Autofix is in beta. Try it out and let us know your feedback at [email:autofix@sentry.io].',
            {
              email: <a href="mailto:autofix@sentry.io" />,
            }
          )}
          tooltipProps={{isHoverable: true}}
        />{' '}
      </Row>
      <SetupDescription>
        {t(
          "Sentry's Autofix uses all of the contextual data surrounding this error to find potential root causes and fixes."
        )}
      </SetupDescription>
      <SetupDescription>
        {t('A few additional setup steps are needed before you can use Autofix.')}
      </SetupDescription>
      <AutofixSetupSteps
        groupId={groupId}
        projectId={projectId}
        autofixSetup={data}
        canStartAutofix={canStartAutofix}
        onSetupComplete={handleSetupComplete}
      />
    </SetupContainer>
  );
}

const Row = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
`;

const SetupContainer = styled('div')`
  padding: ${space(2)};
`;

export const AutofixSetupDone = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 40px;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Title = styled('p')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 0;
`;

const SetupDescription = styled('p')`
  margin-bottom: ${space(1)};
`;

const RepoLinkUl = styled('ul')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  padding: 0;
`;

const RepoLinkItem = styled('li')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const GithubLink = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
