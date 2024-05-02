import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {useAutofixCodebaseIndexing} from 'sentry/components/events/autofix/useAutofixCodebaseIndexing';
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

interface AutofixSetupModalProps extends ModalRenderProps {
  groupId: string;
  projectId: string;
}

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
            'You have an active GitHub installation, but no linked repositories. Add repositories to the integration on the [integration settings page].',
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

function GitRepoLink({repo}: {repo: AutofixSetupRepoDefinition}) {
  if (repo.provider === 'github' || repo.provider.split(':')[1] === 'github') {
    return (
      <RepoLinkItem>
        <GithubLink>
          <ExternalLink href={`https://github.com/${repo.owner}/${repo.name}`}>
            <IconGithub color="linkColor" size="sm" />
            <span>
              {repo.owner}/{repo.name}
            </span>
          </ExternalLink>
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
}: {
  autofixSetup: AutofixSetupResponse;
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
            'The [link:Sentry Autofix Github App] has been installed on all required repositories:',
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
        <GuidedSteps.StepButtons />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <p>
        {tct(
          'Install the [link:Sentry Autofix Github App] on your Github organization or each individual repository with write permissions to enable Autofix.',
          {
            link: (
              <ExternalLink href="https://github.com/apps/sentry-autofix-experimental" />
            ),
          }
        )}
      </p>
      <p>{t(`To run Autofix on this issue, you will need to install the app on:`)}</p>
      <RepoLinkUl>
        {sortedRepos.map(repo => (
          <GitRepoLink key={`${repo.owner}/${repo.name}`} repo={repo} />
        ))}
      </RepoLinkUl>
      <GuidedSteps.StepButtons />
    </Fragment>
  );
}

function AutofixCodebaseIndexingStep({
  autofixSetup,
  projectId,
  groupId,
  closeModal,
}: {
  autofixSetup: AutofixSetupResponse;
  closeModal: () => void;
  groupId: string;
  projectId: string;
}) {
  const {startIndexing} = useAutofixCodebaseIndexing({projectId, groupId});

  const canIndex =
    // autofixSetup.genAIConsent.ok &&
    autofixSetup.integration.ok && autofixSetup.githubWriteIntegration.ok;

  return (
    <Fragment>
      <p>
        {t(
          'Sentry will index your repositories to enable Autofix. This process may take a few minutes.'
        )}
      </p>
      <GuidedSteps.StepButtons>
        <Button
          priority="primary"
          size="sm"
          disabled={!canIndex}
          onClick={() => {
            startIndexing();
            closeModal();
          }}
        >
          {t('Index Repositories & Enable Autofix')}
        </Button>
      </GuidedSteps.StepButtons>
    </Fragment>
  );
}

function AutofixSetupSteps({
  projectId,
  groupId,
  autofixSetup,
  closeModal,
}: {
  autofixSetup: AutofixSetupResponse;
  closeModal: () => void;
  groupId: string;
  projectId: string;
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
        title={t('Install the Sentry Autofix App on Github')}
        isCompleted={autofixSetup.githubWriteIntegration.ok}
      >
        <AutofixGithubIntegrationStep autofixSetup={autofixSetup} />
      </GuidedSteps.Step>
      <GuidedSteps.Step
        stepKey="codebaseIndexing"
        title={t('Enable Autofix')}
        isCompleted={autofixSetup.codebaseIndexing.ok}
      >
        <AutofixCodebaseIndexingStep
          groupId={groupId}
          projectId={projectId}
          autofixSetup={autofixSetup}
          closeModal={closeModal}
        />
      </GuidedSteps.Step>
    </GuidedSteps>
  );
}

function AutofixSetupContent({
  projectId,
  groupId,
  closeModal,
}: {
  closeModal: () => void;
  groupId: string;
  projectId: string;
}) {
  const {data, hasSuccessfulSetup, isLoading, isError} = useAutofixSetup(
    {groupId},
    // Want to check setup status whenever the user comes back to the tab
    {refetchOnWindowFocus: true}
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError message={t('Failed to fetch Autofix setup progress.')} />;
  }

  if (hasSuccessfulSetup) {
    return (
      <AutofixSetupDone>
        <DoneIcon color="success" size="xxl" isCircled />
        <p>{t("You've successfully configured Autofix!")}</p>
        <Button onClick={closeModal} priority="primary">
          {t("Let's go")}
        </Button>
      </AutofixSetupDone>
    );
  }

  return (
    <AutofixSetupSteps
      groupId={groupId}
      projectId={projectId}
      autofixSetup={data}
      closeModal={closeModal}
    />
  );
}

export function AutofixSetupModal({
  Header,
  Body,
  groupId,
  projectId,
  closeModal,
}: AutofixSetupModalProps) {
  return (
    <Fragment>
      <Header closeButton>
        <h3>{t('Configure Autofix')}</h3>
      </Header>
      <Body>
        <AutofixSetupContent
          projectId={projectId}
          groupId={groupId}
          closeModal={closeModal}
        />
      </Body>
    </Fragment>
  );
}

const AutofixSetupDone = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 40px;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const DoneIcon = styled(IconCheckmark)`
  margin-bottom: ${space(4)};
`;

const RepoLinkUl = styled('ul')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const RepoLinkItem = styled('li')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const GithubLink = styled('div')`
  display: flex;
  align-items: center;

  a {
    display: flex;
    align-items: center;
  }

  svg {
    margin-right: ${space(0.5)};
  }
`;
