import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {
  type AutofixSetupRepoDefinition,
  type AutofixSetupResponse,
  useAutofixSetup,
} from 'sentry/components/events/autofix/useAutofixSetup';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark, IconGithub} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

function AutofixIntegrationStep({autofixSetup}: {autofixSetup: AutofixSetupResponse}) {
  if (autofixSetup.integration.ok) {
    return (
      <Fragment>
        {tct('The GitHub integration is already installed, [link: view in settings].', {
          link: <ExternalLink href={`/settings/integrations/github/`} />,
        })}
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

function SetupStep({
  title,
  isCompleted,
  children,
}: {
  children: React.ReactNode;
  isCompleted: boolean;
  title: string;
}) {
  return (
    <StepWrapper>
      <StepHeader>
        <StepTitle>{title}</StepTitle>
        {isCompleted && <IconCheckmark color="success" size="sm" />}
      </StepHeader>
      <div>{children}</div>
    </StepWrapper>
  );
}

function AutofixSetupSteps({autofixSetup}: {autofixSetup: AutofixSetupResponse}) {
  return (
    <SetupStep
      title={t('Install the GitHub Integration')}
      isCompleted={autofixSetup.integration.ok}
    >
      <AutofixIntegrationStep autofixSetup={autofixSetup} />
    </SetupStep>
  );
}

export function AutofixSetupContent({
  projectId,
  groupId,
}: {
  groupId: string;
  projectId: string;
}) {
  const organization = useOrganization();
  const {data, isPending, isError} = useAutofixSetup(
    {groupId},
    // Want to check setup status whenever the user comes back to the tab
    {refetchOnWindowFocus: true}
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    trackAnalytics('autofix.setup_modal_viewed', {
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
    <Fragment>
      <Divider />
      <Header>Set up Autofix</Header>
      <p>
        Sentry's AI-enabled Autofix uses all of the contextual data surrounding this error
        to work with you to find the root cause and create a fix.
      </p>
      <p>To use Autofix, please follow the instructions below.</p>
      <AutofixSetupSteps autofixSetup={data} />
    </Fragment>
  );
}

export const AutofixSetupDone = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 40px;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Header = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(2)};
  margin-top: ${space(2)};
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

const Divider = styled('div')`
  margin: ${space(3)} 0;
  border-bottom: 2px solid ${p => p.theme.gray100};
`;

const StepWrapper = styled('div')`
  margin-top: ${space(3)};
  padding-left: ${space(2)};
  border-left: 2px solid ${p => p.theme.border};
`;

const StepHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const StepTitle = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  margin: 0;
`;
