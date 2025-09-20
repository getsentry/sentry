import {Fragment, useCallback, useEffect, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import testAnalyticsTestPerfDark from 'sentry-images/features/test-analytics-test-perf-dark.svg';
import testAnalyticsTestPerf from 'sentry-images/features/test-analytics-test-perf.svg';

import {Container, Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {IntegratedOrgSelector} from 'sentry/components/prevent/integratedOrgSelector/integratedOrgSelector';
import {RepoSelector} from 'sentry/components/prevent/repoSelector/repoSelector';
import {t, tct} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {AddScriptToYamlStep} from 'sentry/views/prevent/tests/onboardingSteps/addScriptToYamlStep';
import {AddUploadTokenStep} from 'sentry/views/prevent/tests/onboardingSteps/addUploadTokenStep';
import {
  ChooseUploadPermissionStep,
  UploadPermission,
} from 'sentry/views/prevent/tests/onboardingSteps/chooseUploadPermissionStep';
import {EditGHAWorkflowStep} from 'sentry/views/prevent/tests/onboardingSteps/editGHAWorkflowStep';
import {InstallPreventCLIStep} from 'sentry/views/prevent/tests/onboardingSteps/installPreventCLIStep';
import {OutputCoverageFileStep} from 'sentry/views/prevent/tests/onboardingSteps/outputCoverageFileStep';
import {RunTestSuiteStep} from 'sentry/views/prevent/tests/onboardingSteps/runTestSuiteStep';
import {UploadFileCLIStep} from 'sentry/views/prevent/tests/onboardingSteps/uploadFileCLIStep';
import {ViewResultsInsightsStep} from 'sentry/views/prevent/tests/onboardingSteps/viewResultsInsightsStep';
import TestPreOnboardingPage from 'sentry/views/prevent/tests/preOnboarding';
import {useRepo} from 'sentry/views/prevent/tests/queries/useRepo';
import {EmptySelectorsMessage} from 'sentry/views/prevent/tests/tests';

enum SetupOption {
  GITHUB_ACTION = 'githubAction',
  CLI = 'cli',
}

export default function TestsOnboardingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {integratedOrgId, repository} = usePreventContext();
  const {data: repoData, isSuccess} = useRepo();
  const opt = searchParams.get('opt');

  const theme = useTheme();
  const isDarkMode = theme.type === 'dark';

  const handleRadioChange = useCallback(
    (newOption: SetupOption) => {
      setSearchParams({opt: newOption});
    },
    [setSearchParams]
  );
  const [selectedUploadPermission, setSelectedUploadPermission] =
    useState<UploadPermission>(UploadPermission.OIDC);

  useEffect(() => {
    if (repoData?.testAnalyticsEnabled && isSuccess) {
      navigate('/prevent/tests');
    }
  }, [repoData?.testAnalyticsEnabled, navigate, isSuccess]);

  const {data: integrations = [], isPending} = useApiQuery<OrganizationIntegration[]>(
    [
      `/organizations/${organization.slug}/integrations/`,
      {query: {includeConfig: 0, provider_key: 'github'}},
    ],
    {staleTime: 0}
  );

  if (isPending) {
    return (
      <LayoutGap>
        <LoadingIndicator />
      </LayoutGap>
    );
  }

  if (!integrations.length) {
    return (
      <LayoutGap>
        <TestPreOnboardingPage />
      </LayoutGap>
    );
  }

  const uploadPermissionOidcSteps = (
    <Fragment>
      <EditGHAWorkflowStep step="3" />
      <RunTestSuiteStep step="4" />
      <ViewResultsInsightsStep step="5" />
    </Fragment>
  );

  const uploadPermissionUploadTokenSteps = (
    <Fragment>
      <AddUploadTokenStep step="2b" />
      <AddScriptToYamlStep step="3" />
      <RunTestSuiteStep step="4" />
      <ViewResultsInsightsStep step="5" />
    </Fragment>
  );

  const githubActionSteps = (
    <Fragment>
      <OutputCoverageFileStep step="1" />
      <ChooseUploadPermissionStep
        step="2"
        selectedUploadPermission={selectedUploadPermission}
        setSelectedUploadPermission={setSelectedUploadPermission}
      />
      {selectedUploadPermission === UploadPermission.OIDC
        ? uploadPermissionOidcSteps
        : uploadPermissionUploadTokenSteps}
    </Fragment>
  );

  const cliSteps = (
    <Fragment>
      <OutputCoverageFileStep step="1" />
      <AddUploadTokenStep step="2" />
      <InstallPreventCLIStep step="3" />
      <UploadFileCLIStep previousStep="3" step="4" />
      <RunTestSuiteStep step="5" />
      <ViewResultsInsightsStep step="6" />
    </Fragment>
  );

  return (
    <LayoutGap>
      <PageFilterBar condensed>
        <IntegratedOrgSelector />
        <RepoSelector />
      </PageFilterBar>
      {integratedOrgId && repository ? (
        <OnboardingContainer>
          <OnboardingContent>
            <IntroContainer>
              <Flex justify="between" gap="2xl">
                <div>
                  <GetStartedHeader>
                    {t('Get Started with Test Analytics')}
                  </GetStartedHeader>
                  <TAValueText>
                    {t(
                      'Test Analytics offers data on test run times, failure rates, and identifies flaky tests to help decrease the risk of deployment failures and make it easier to ship new features quickly.'
                    )}
                  </TAValueText>
                </div>
                <PreviewImg
                  src={isDarkMode ? testAnalyticsTestPerfDark : testAnalyticsTestPerf}
                  alt={t('Test Analytics example')}
                />
              </Flex>
            </IntroContainer>
            <SelectOptionHeader>{t('Select a setup option')}</SelectOptionHeader>
            <RadioGroup
              label="Select a setup option"
              value={
                opt === SetupOption.CLI ? SetupOption.CLI : SetupOption.GITHUB_ACTION
              }
              onChange={handleRadioChange}
              choices={[
                [SetupOption.GITHUB_ACTION, t('Use GitHub Actions to run my CI')],
                [
                  SetupOption.CLI,
                  t("Use Sentry Prevent's CLI to upload testing reports"),
                ],
              ]}
            />
            <Flex direction="column" gap="2xl" maxWidth="1000px" padding="2xl 0 0 3xl">
              {opt === SetupOption.CLI ? cliSteps : githubActionSteps}
              <div>
                {tct(
                  'To learn more about Test Analytics, please visit [ourDocs:our docs].',
                  {
                    ourDocs: (
                      <ExternalLink href="https://docs.sentry.io/product/test-analytics/" />
                    ),
                  }
                )}
              </div>
            </Flex>
          </OnboardingContent>
        </OnboardingContainer>
      ) : (
        <EmptySelectorsMessage />
      )}
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
`;

const OnboardingContainer = styled(Container)`
  padding: ${p => p.theme.space['3xl']};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  max-width: 1200px;
`;

const OnboardingContent = styled('div')`
  max-width: 1000px;
`;

const IntroContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  padding-bottom: ${p => p.theme.space['2xl']};
`;

const PreviewImg = styled('img')`
  align-self: center;
`;

const GetStartedHeader = styled('h2')`
  font-size: 1.625rem;
  color: ${p => p.theme.tokens.content.primary};
  line-height: 40px;
`;

const TAValueText = styled('p')`
  font-size: ${p => p.theme.fontSize.lg};
  color: ${p => p.theme.tokens.content.primary};
  margin: 0;
`;

const SelectOptionHeader = styled('h5')`
  font-size: ${p => p.theme.fontSize.xl};
  color: ${p => p.theme.tokens.content.primary};
  padding-top: ${p => p.theme.space['2xl']};
`;
