import {Fragment} from 'react';
import styled from '@emotion/styled';

import onboardingInstall from 'sentry-images/spot/onboarding-install.svg';

import {LinkButton} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import type {AutofixRepository} from 'sentry/components/events/autofix/types';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface SolutionsHubNoticesProps {
  autofixRepositories: AutofixRepository[];
  hasGithubIntegration?: boolean;
}

function GithubIntegrationSetupCard() {
  return (
    <IntegrationCard key="no-readable-repos">
      <CardContent>
        <CardTitle>{t('Set Up the GitHub Integration')}</CardTitle>
        <CardDescription>
          <span>
            {tct('Autofix is [bold:a lot better] when it has your codebase as context.', {
              bold: <b />,
            })}
          </span>
          <span>
            {tct(
              'Set up the [integrationLink:GitHub Integration] to allow Autofix to go deeper when troubleshooting and fixing your issues–including writing the code and opening PRs.',
              {
                integrationLink: <ExternalLink href="/settings/integrations/github/" />,
              }
            )}
          </span>
        </CardDescription>
        <LinkButton href="/settings/integrations/github/" size="sm" priority="primary">
          {t('Set Up Now')}
        </LinkButton>
      </CardContent>
      <CardIllustration src={onboardingInstall} alt="Install" />
    </IntegrationCard>
  );
}

export function SolutionsHubNotices({
  autofixRepositories,
  hasGithubIntegration,
}: SolutionsHubNoticesProps) {
  const unreadableRepos = autofixRepositories.filter(repo => repo.is_readable === false);
  const notices: JSX.Element[] = [];

  const integrationId = autofixRepositories.find(repo =>
    repo.provider.includes('github')
  )?.integration_id;

  if (!hasGithubIntegration) {
    notices.push(<GithubIntegrationSetupCard key="github-setup" />);
  }

  if (unreadableRepos.length > 1) {
    const githubRepos = unreadableRepos.filter(repo => repo.provider.includes('github'));
    const nonGithubRepos = unreadableRepos.filter(
      repo => !repo.provider.includes('github')
    );

    notices.push(
      <Alert type="warning" showIcon key="multiple-repos">
        {tct("Autofix can't access these repositories: [repoList].", {
          repoList: <b>{unreadableRepos.map(repo => repo.name).join(', ')}</b>,
        })}
        {githubRepos.length > 0 && (
          <Fragment>
            {' '}
            {tct(
              'For best performance, enable the [integrationLink:GitHub integration] and its [codeMappingsLink:code mappings].',
              {
                integrationLink: (
                  <ExternalLink
                    href={
                      integrationId
                        ? `/settings/integrations/github/${integrationId}/`
                        : '/settings/integrations/github/'
                    }
                  />
                ),
                codeMappingsLink: integrationId ? (
                  <ExternalLink
                    href={`/settings/integrations/github/${integrationId}/?tab=codeMappings`}
                  />
                ) : null,
              }
            )}
          </Fragment>
        )}
        {nonGithubRepos.length > 0 && (
          <Fragment>
            {' '}
            {t('Autofix currently only supports GitHub repositories.')}
          </Fragment>
        )}
      </Alert>
    );
  } else if (unreadableRepos.length === 1) {
    const unreadableRepo = unreadableRepos[0]!;
    notices.push(
      <Alert type="warning" showIcon key="single-repo">
        {unreadableRepo.provider.includes('github')
          ? tct(
              "Autofix can't access the [repo] repository, make sure the [integrationLink:GitHub integration] and its [codeMappingsLink:code mappings] are correctly set up.",
              {
                repo: <b>{unreadableRepo.name}</b>,
                integrationLink: (
                  <ExternalLink
                    href={`/settings/integrations/github/${unreadableRepo.integration_id}`}
                  />
                ),
                codeMappingsLink: (
                  <ExternalLink
                    href={`/settings/integrations/github/${unreadableRepo.integration_id}/?tab=codeMappings`}
                  />
                ),
              }
            )
          : tct(
              "Autofix can't access the [repo] repository. It currently only supports GitHub repositories.",
              {
                repo: <b>{unreadableRepo.name}</b>,
              }
            )}
      </Alert>
    );
  }

  if (notices.length === 0) {
    return null;
  }

  return <NoticesContainer>{notices}</NoticesContainer>;
}

const NoticesContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  align-items: stretch;
  margin-bottom: ${space(2)};
`;

const IntegrationCard = styled('div')`
  position: relative;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: ${space(1)};
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
`;

const CardContent = styled('div')`
  padding: ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  align-items: flex-start;
`;

const CardDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const CardTitle = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 600;
  margin-bottom: 0;
`;

const CardIllustration = styled('img')`
  height: 100%;
  object-fit: contain;
  max-width: 30%;
  margin-bottom: -6px;
  margin-right: 10px;
`;
