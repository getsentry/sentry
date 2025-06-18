import {useCallback, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AddScriptToYaml} from 'sentry/views/codecov/tests/onboardingSteps/addScriptToYaml';
import {AddUploadToken} from 'sentry/views/codecov/tests/onboardingSteps/addUploadToken';
import type {UploadPermission} from 'sentry/views/codecov/tests/onboardingSteps/chooseUploadPermission';
import {ChooseUploadPermission} from 'sentry/views/codecov/tests/onboardingSteps/chooseUploadPermission';
import {EditGHAWorkflow} from 'sentry/views/codecov/tests/onboardingSteps/editGHAWorkflow';
import {InstallPreventCLI} from 'sentry/views/codecov/tests/onboardingSteps/installPreventCLI';
import {OutputCoverageFile} from 'sentry/views/codecov/tests/onboardingSteps/outputCoverageFile';
import TestPreOnboardingPage from 'sentry/views/codecov/tests/preOnboarding';

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

  // TODO: modify to designate full scenario for GHAction vs CLI

  return (
    <LayoutGap>
      <TestPreOnboardingPage />
      <OnboardingContainer>
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
          <OutputCoverageFile step="1" />
          {/* TODO coming soon: we will conditionally render this based on CLI vs GHAction and OIDC vs Token for CLI */}
          <ChooseUploadPermission
            step="2a"
            selectedUploadPermission={selectedUploadPermission}
            setSelectedUploadPermission={setSelectedUploadPermission}
          />
          <AddUploadToken step="2b" />
          <AddScriptToYaml step="3" />
          <InstallPreventCLI step="3" />
          <EditGHAWorkflow step="3" />
        </StepsContainer>
      </OnboardingContainer>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const OnboardingContainer = styled('div')`
  padding: ${space(1.5)} ${space(4)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  max-width: 800px;
`;

const IntroContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  padding-bottom: ${space(3)};
`;

const GetStartedHeader = styled('h2')`
  font-size: 1.625rem;
  color: ${p => p.theme.tokens.content.primary};
  line-height: 40px;
`;

const TAValueText = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.tokens.content.primary};
`;

const SelectOptionHeader = styled('h5')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.tokens.content.primary};
  margin-top: ${space(3)};
`;

const StepsContainer = styled('div')`
  padding: ${space(3)} ${space(4)};
`;
