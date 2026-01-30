import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import testAnalyticsRepoSecretDark from 'sentry-images/features/test-analytics-repo-secret-dark.png';
import testAnalyticsRepoSecretLight from 'sentry-images/features/test-analytics-repo-secret-light.png';

import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {integratedOrgIdToDomainName} from 'sentry/components/prevent/utils';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';
import {useGetActiveIntegratedOrgs} from 'sentry/views/prevent/tests/queries/useGetActiveIntegratedOrgs';
import {useRepo} from 'sentry/views/prevent/tests/queries/useRepo';
import {useRegenerateRepositoryToken} from 'sentry/views/prevent/tokens/repoTokenTable/hooks/useRegenerateRepositoryToken';

interface AddUploadTokenStepProps {
  step: string;
}

export function AddUploadTokenStep({step}: AddUploadTokenStepProps) {
  const organization = useOrganization();
  const theme = useTheme();
  const isDarkMode = theme.type === 'dark';
  const {integratedOrgId, repository} = usePreventContext();
  const {data: repoData} = useRepo();

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
          <Text>
            {tct(
              'Sentry requires a token to authenticate uploading your coverage reports. GitHub [repoAdmin] is required to access organization settings > secrets and variables > actions',
              {
                repoAdmin: <b>{t('Repository admin')}</b>,
              }
            )}
          </Text>
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
                {integratedOrgId && repository && (
                  <Button
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
                )}
              </Flex>
            </Fragment>
          ) : integratedOrgId && repository ? (
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
          ) : null}
        </OnboardingStep.Content>
      </OnboardingStep.Body>
      <OnboardingStep.ExpandableDropdown
        triggerContent={t('Your repository secret in GitHub should look like this:')}
      >
        <img
          src={isDarkMode ? testAnalyticsRepoSecretDark : testAnalyticsRepoSecretLight}
        />
      </OnboardingStep.ExpandableDropdown>
    </OnboardingStep.Container>
  );
}

const RightPaddedCodeSnippet = styled(CodeBlock)`
  padding-right: ${p => p.theme.space['2xl']};
`;
