import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import testAnalyticsRepoSecretDark from 'sentry-images/features/test-analytics-repo-secret-dark.png';
import testAnalyticsRepoSecretLight from 'sentry-images/features/test-analytics-repo-secret-light.png';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {integratedOrgIdToDomainName} from 'sentry/components/prevent/utils';
import {t, tct} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface AddUploadTokenStepProps {
  step: string;
}

// HARDCODED VALUES FOR TESTING
const FULL_TOKEN = '91b57316-b1ff-4884-8d55-92b9936a05a3';

export function AddUploadTokenStep({step}: AddUploadTokenStepProps) {
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const organization = useOrganization();
  const {repository, integratedOrgId} = usePreventContext();

  const theme = useTheme();
  const isDarkMode = theme.type === 'dark';

  const {data: integrations = []} = useApiQuery<Integration[]>(
    [
      `/organizations/${organization.slug}/integrations/`,
      {query: {includeConfig: 0, provider_key: 'github'}},
    ],
    {staleTime: 0}
  );
  const githubOrgDomain = integratedOrgIdToDomainName(integratedOrgId, integrations);
  const githubUrl =
    githubOrgDomain && repository
      ? `https://${githubOrgDomain}/${repository}/settings/secrets/actions`
      : '#';

  const headerText = tct(`Step [step]: Add token as [repositorySecret]`, {
    step,
    repositorySecret: <Link to={githubUrl}>{t('repository secret')}</Link>,
  });

  const handleGenerateClick = () => {
    setShowTokenDetails(true);
  };

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
          {showTokenDetails ? (
            <Fragment>
              <Flex justify="between" gap="md">
                <Flex justify="between" gap="md">
                  <RightPaddedCodeSnippet dark>
                    SENTRY_PREVENT_TOKEN
                  </RightPaddedCodeSnippet>
                  <RightPaddedCodeSnippet dark>{FULL_TOKEN}</RightPaddedCodeSnippet>
                </Flex>
                <Button priority="default" onClick={handleGenerateClick}>
                  {t('Regenerate')}
                </Button>
              </Flex>
            </Fragment>
          ) : (
            <Button priority="primary" onClick={handleGenerateClick}>
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
