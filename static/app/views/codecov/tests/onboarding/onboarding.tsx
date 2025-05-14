import {useState} from 'react';
import styled from '@emotion/styled';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OutputCoverageFile} from 'sentry/views/codecov/tests/onboarding/outputCoverageFile';

type SetupOption = 'githubAction' | 'cli';

export default function TestsOnboardingPage() {
  const [selectedOption, setSelectedOption] = useState<SetupOption>('githubAction');

  return (
    <LayoutGap>
      <p>Test Analytics Onboarding</p>
      <OnboardingContainer>
        <IntroContainer>
          <GetStartedHeader>{t('Get Started with Test Analytics')}</GetStartedHeader>
          <TAValueText>
            {t(
              'Test Analytics offers data on test run times, failure rates, and identifies flaky tests to help decrease the risk of deployment failures and make it easier to ship new features quickly.'
            )}
          </TAValueText>
        </IntroContainer>
        <SelectOptionHeader>Select a setup option</SelectOptionHeader>
        <RadioGroup
          label="Select a setup option"
          value={selectedOption}
          onChange={opt => setSelectedOption(opt as SetupOption)}
          choices={[
            ['githubAction', t('Use GitHub Actions to run my CI')],
            ['cli', t("Use Sentry Prevent's CLI to upload testing reports")],
          ]}
        />
        <StepsContainer>
          <OutputCoverageFile stepString="1" />
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
`;

const IntroContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
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
