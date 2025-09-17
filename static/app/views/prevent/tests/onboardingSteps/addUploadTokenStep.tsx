import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import testAnalyticsRepoSecretDark from 'sentry-images/features/test-analytics-repo-secret-dark.png';
import testAnalyticsRepoSecretLight from 'sentry-images/features/test-analytics-repo-secret-light.png';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {integratedOrgIdToDomainName} from 'sentry/components/prevent/utils';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';
import {useGetActiveIntegratedOrgs} from 'sentry/views/prevent/tests/queries/useGetActiveIntegratedOrgs';
import type {Repository} from 'sentry/views/prevent/tests/queries/useRepo';
import {useRegenerateRepositoryToken} from 'sentry/views/prevent/tokens/repoTokenTable/hooks/useRegenerateRepositoryToken';

interface AddUploadTokenStepProps {
  integratedOrgId: string;
  repository: string;
  step: string;
  repoData?: Repository;
}

export function AddUploadTokenStep({
  repoData,
  step,
  repository,
  integratedOrgId,
}: AddUploadTokenStepProps) {
  const organization = useOrganization();
  const theme = useTheme();
  const isDarkMode = theme.type === 'dark';

  const {data: integrations = []} = useGetActiveIntegratedOrgs({organization});
  const githubOrgDomain = integratedOrgIdToDomainName(integratedOrgId, integrations);
  const githubUrl =
    githubOrgDomain && repository
      ? `https://${githubOrgDomain}/${repository}/settings/secrets/actions`
      : '#';

  const headerText = tct(
    `Step [step]: Add token as [repositorySecret:repository secret]`,
    {
      step,
      repositorySecret: <ExternalLink href={githubUrl} />,
    }
  );

  const {mutate: regenerateToken} = useRegenerateRepositoryToken();

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
        <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
        <OnboardingStep.Content>
          <p>
            {tct(
              'Sentry requires a token to authenticate uploading your coverage reports. GitHub [repoAdmin] is required to access organization settings > secrets and variables > actions',
              {
                repoAdmin: <b>{t('Repository admin')}</b>,
              }
            )}
          </p>
          {repoData?.uploadToken ? (
            <Fragment>
              <Flex justify="between" gap="md">
                <Flex justify="between" gap="md">
                  <RightPaddedCodeSnippet dark>
                    SENTRY_PREVENT_TOKEN
                  </RightPaddedCodeSnippet>
                  <RightPaddedCodeSnippet dark>
                    {repoData.uploadToken}
                  </RightPaddedCodeSnippet>
                </Flex>
                <Button
                  priority="default"
                  onClick={() => {
                    regenerateToken({
                      orgSlug: organization.slug,
                      integratedOrgId,
                      repository,
                    });
                  }}
                >
                  {t('Regenerate')}
                </Button>
              </Flex>
            </Fragment>
          ) : (
            <Button
              priority="primary"
              onClick={() => {
                regenerateToken({
                  orgSlug: organization.slug,
                  integratedOrgId,
                  repository,
                });
              }}
            >
              {t('Generate Repository Token')}
            </Button>
          )}
        </OnboardingStep.Content>
      </OnboardingStep.Body>
      <OnboardingStep.ExpandableDropdown
        triggerContent={
          <div>{t('Your repository secret in GitHub should look like this:')}</div>
        }
      >
        <img
          src={isDarkMode ? testAnalyticsRepoSecretDark : testAnalyticsRepoSecretLight}
        />
      </OnboardingStep.ExpandableDropdown>
    </OnboardingStep.Container>
  );
}

const RightPaddedCodeSnippet = styled(CodeSnippet)`
  padding-right: ${p => p.theme.space['2xl']};
`;
