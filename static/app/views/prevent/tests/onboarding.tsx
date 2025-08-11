import {useCallback, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {t, tct} from 'sentry/locale';
import {AddScriptToYamlStep} from 'sentry/views/prevent/tests/onboardingSteps/addScriptToYamlStep';
import {AddUploadTokenStep} from 'sentry/views/prevent/tests/onboardingSteps/addUploadTokenStep';
import type {UploadPermission} from 'sentry/views/prevent/tests/onboardingSteps/chooseUploadPermissionStep';
import {ChooseUploadPermissionStep} from 'sentry/views/prevent/tests/onboardingSteps/chooseUploadPermissionStep';
import {EditGHAWorkflowStep} from 'sentry/views/prevent/tests/onboardingSteps/editGHAWorkflowStep';
import {InstallPreventCLIStep} from 'sentry/views/prevent/tests/onboardingSteps/installPreventCLIStep';
import {OutputCoverageFileStep} from 'sentry/views/prevent/tests/onboardingSteps/outputCoverageFileStep';
import {RunTestSuiteStep} from 'sentry/views/prevent/tests/onboardingSteps/runTestSuiteStep';
import {UploadFileCLIStep} from 'sentry/views/prevent/tests/onboardingSteps/uploadFileCLIStep';
import {ViewResultsInsightsStep} from 'sentry/views/prevent/tests/onboardingSteps/viewResultsInsightsStep';
import TestPreOnboardingPage from 'sentry/views/prevent/tests/preOnboarding';

type SetupOption = 'githubAction' | 'cli';

export default function TestsOnboardingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const opt = searchParams.get('opt');

  const handleRadioChange = useCallback(
    (newOption: SetupOption) => {
      setSearchParams({opt: newOption});
    },
    [setSearchParams]
  );
  const [selectedUploadPermission, setSelectedUploadPermission] =
    useState<UploadPermission>('oidc');

  if (searchParams.get('preOnb') !== null) {
    return (
      <LayoutGap>
        <TestPreOnboardingPage />
      </LayoutGap>
    );
  }

  // TODO: modify to designate full scenario for GHAction vs CLI
  return (
    <LayoutGap>
      <OnboardingContainer>
        <OnboardingContent>
          <IntroContainer>
            <GetStartedHeader>{t('Get Started with Test Analytics')}</GetStartedHeader>
            <TAValueText>
              {t(
                'Test Analytics offers data on test run times, failure rates, and identifies flaky tests to help decrease the risk of deployment failures and make it easier to ship new features quickly.'
              )}
            </TAValueText>
          </IntroContainer>
          <SelectOptionHeader>{t('Select a setup option')}</SelectOptionHeader>
          <RadioGroup
            label="Select a setup option"
            value={opt === 'cli' ? 'cli' : 'githubAction'}
            onChange={handleRadioChange}
            choices={[
              ['githubAction', t('Use GitHub Actions to run my CI')],
              ['cli', t("Use Sentry Prevent's CLI to upload testing reports")],
            ]}
          />
          <StepsContainer>
            <OutputCoverageFileStep step="1" />
            {/* TODO coming soon: we will conditionally render this based on CLI vs GHAction and OIDC vs Token for CLI */}
            <ChooseUploadPermissionStep
              step="2a"
              selectedUploadPermission={selectedUploadPermission}
              setSelectedUploadPermission={setSelectedUploadPermission}
            />
            <AddUploadTokenStep step="2b" />
            <AddScriptToYamlStep step="3" />
            <InstallPreventCLIStep step="3" />
            <EditGHAWorkflowStep step="3" />
            <RunTestSuiteStep step="4" />
            <UploadFileCLIStep previousStep="3" step="4" />
            <ViewResultsInsightsStep step="5" />
            <div>
              {tct('To learn more about Test Analytics, please visit [ourDocs].', {
                ourDocs: (
                  <Link to="https://docs.sentry.io/product/test-analytics/">
                    our docs
                  </Link>
                ),
              })}
            </div>
          </StepsContainer>
        </OnboardingContent>
      </OnboardingContainer>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
`;

const OnboardingContainer = styled('div')`
  padding: ${p => p.theme.space.lg} ${p => p.theme.space['3xl']};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const OnboardingContent = styled('div')`
  max-width: 1000px;
`;

const IntroContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  padding-bottom: ${p => p.theme.space['2xl']};
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
  margin-top: ${p => p.theme.space['2xl']};
`;

const StepsContainer = styled('div')`
  padding-top: ${p => p.theme.space['2xl']};
  padding-left: ${p => p.theme.space['3xl']};
  max-width: 1000px;
`;
