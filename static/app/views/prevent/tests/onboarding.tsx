import {Fragment, useCallback, useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useTheme} from '@emotion/react';

import testAnalyticsTestPerfDark from 'sentry-images/features/test-analytics-test-perf-dark.svg';
import testAnalyticsTestPerf from 'sentry-images/features/test-analytics-test-perf.svg';

import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Heading, Prose, Text} from 'sentry/components/core/text';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {IntegratedOrgSelector} from 'sentry/components/prevent/integratedOrgSelector/integratedOrgSelector';
import {RepoSelector} from 'sentry/components/prevent/repoSelector/repoSelector';
import {getPreventParamsString} from 'sentry/components/prevent/utils';
import {t, tct} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
import {useRepo} from 'sentry/views/prevent/tests/queries/useRepo';
import {EmptySelectorsMessage} from 'sentry/views/prevent/tests/tests';

enum SetupOption {
  GITHUB_ACTION = 'githubAction',
  CLI = 'cli',
}

export default function TestsOnboardingPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const organization = useOrganization();
  const {integratedOrgId, repository} = usePreventContext();
  const {data: repoData, isSuccess: isRepoSuccess} = useRepo();
  const navigate = useNavigate();
  const opt = searchParams.get('opt');

  const theme = useTheme();
  const isDarkMode = theme.type === 'dark';

  const handleRadioChange = useCallback(
    (newOption: SetupOption) => setSearchParams({opt: newOption}),
    [setSearchParams]
  );
  const [selectedUploadPermission, setSelectedUploadPermission] =
    useState<UploadPermission>(UploadPermission.OIDC);

  const {
    data: integrations = [],
    isPending: isIntegrationsPending,
    isSuccess: isIntegrationsSuccess,
  } = useApiQuery<OrganizationIntegration[]>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/integrations/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {includeConfig: 0, provider_key: 'github'}},
    ],
    {staleTime: 0}
  );

  const regionData = getRegionDataFromOrganization(organization);
  const isUSStorage = regionData?.name?.toLowerCase() === 'us';
  const cameFromTestsRoute = location.state?.from === '/prevent/tests';

  // We want to navigate to show TA if this repo should have data to show, if we need to show
  // preOnboarding when they have no integrations, or if this org is not in the US region
  useEffect(() => {
    if (
      !cameFromTestsRoute &&
      ((repoData?.testAnalyticsEnabled && isRepoSuccess) ||
        (!integrations.length && isIntegrationsSuccess) ||
        !isUSStorage)
    ) {
      const queryString = getPreventParamsString(location);
      navigate(`/prevent/tests${queryString ? `?${queryString}` : ''}`, {
        state: {from: '/prevent/tests/new'},
        replace: true,
      });
    }
    // No `location` dependency as it causes infinite loop of redirect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cameFromTestsRoute,
    repoData?.testAnalyticsEnabled,
    isRepoSuccess,
    integrations.length,
    isIntegrationsSuccess,
    isUSStorage,
    navigate,
  ]);

  if (
    !cameFromTestsRoute &&
    ((repoData?.testAnalyticsEnabled && isRepoSuccess) ||
      (!integrations.length && isIntegrationsSuccess) ||
      !isUSStorage)
  ) {
    return null;
  }

  if (isIntegrationsPending) {
    return (
      <Grid gap="xl">
        <LoadingIndicator />
      </Grid>
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
    <Grid gap="xl">
      <PageFilterBar condensed>
        <IntegratedOrgSelector />
        <RepoSelector />
      </PageFilterBar>
      {integratedOrgId && repository ? (
        <Container padding="3xl" border="primary" maxWidth="1100px" radius="md">
          <Flex gap="2xl" direction="column">
            <Flex
              justify="between"
              gap="2xl"
              borderBottom="muted"
              paddingBottom="xl"
              align="center"
            >
              <Prose>
                <Heading as="h2" size="2xl">
                  {t('Get Started with Test Analytics')}
                </Heading>
                <Text size="lg">
                  {t(
                    'Test Analytics offers data on test run times, failure rates, and identifies flaky tests to help decrease the risk of deployment failures and make it easier to ship new features quickly.'
                  )}
                </Text>
              </Prose>
              <img
                src={isDarkMode ? testAnalyticsTestPerfDark : testAnalyticsTestPerf}
                alt={t('Test Analytics example')}
              />
            </Flex>
            <Heading as="h5" size="xl">
              {t('Select a setup option')}
            </Heading>
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
            <Flex direction="column" gap="2xl" maxWidth="1000px" paddingLeft="3xl">
              {opt === SetupOption.CLI ? cliSteps : githubActionSteps}
              <Text>
                {tct('To learn more check out the [docsLink:Test Analytics docs].', {
                  docsLink: (
                    <ExternalLink href="https://docs.sentry.io/product/test-analytics/" />
                  ),
                })}
              </Text>
            </Flex>
          </Flex>
        </Container>
      ) : (
        <EmptySelectorsMessage />
      )}
    </Grid>
  );
}
