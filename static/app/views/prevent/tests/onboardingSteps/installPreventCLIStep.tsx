import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {ExternalLink} from 'sentry/components/core/link';
import {Select} from 'sentry/components/core/select';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface InstallPreventCLIStepProps {
  step: string;
}

type Method = 'pip' | 'binary';

const PLATFORMS = {
  macOS: {label: 'MacOS', value: 'macos'},
  windows: {label: 'Windows', value: 'windows.exe'},
  linux_x86_64: {label: 'Linux x86_64', value: 'linux_x86_64'},
  linux_arm64: {label: 'Linux Arm64', value: 'linux_arm64'},
  alpine_arm64: {label: 'Alpine Linux Arm64', value: 'alpine_arm64'},
  alpine_x86_64: {label: 'Alpine Linux x86_64', value: 'alpine_x86_64'},
} as const;
type Platform = keyof typeof PLATFORMS;
const PLATFORM_OPTIONS = Object.values(PLATFORMS);

const PIP_SNIPPET = `pip install sentry-prevent-cli
sentry-prevent-cli upload --report-type test-results --token <SENTRY_PREVENT_TOKEN>`;

const getBinarySnippet = (
  platformSuffix: string
) => `curl -LOs https://github.com/getsentry/prevent-cli/releases/latest/download/sentry-prevent-cli_${platformSuffix}
chmod u+x sentry-prevent-cli_${platformSuffix}
./sentry-prevent-cli_${platformSuffix} -v upload --report-type test-results --token <SENTRY_PREVENT_TOKEN>`;

export function InstallPreventCLIStep({step}: InstallPreventCLIStepProps) {
  const [method, setMethod] = useState<Method>('pip');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('macOS');

  const headerText = tct(
    'Step [step]: Install the [preventLink] to your CI environment',
    {
      step,
      preventLink: (
        <ExternalLink href="https://docs.sentry.io/product/test-analytics/sentry-prevent-cli/">
          {t('Sentry Prevent CLI')}
        </ExternalLink>
      ),
    }
  );

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
        <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
        <OnboardingStep.Content>
          <RadioGroup
            label="install method"
            value={method}
            onChange={setMethod}
            choices={[
              ['pip', t('Using pip (for Python users)')],
              ['binary', t('By downloading and installing a binary')],
            ]}
          />
          {method === 'pip' ? (
            <Fragment>
              <Paragraph>
                {t(
                  'If you have Python installed already, you can run the script below to install the Sentry Prevent CLI.'
                )}
              </Paragraph>
              <CodeSnippet dark language="bash">
                {PIP_SNIPPET}
              </CodeSnippet>
              {CLILink}
            </Fragment>
          ) : null}
          {method === 'binary' ? (
            <Fragment>
              <Paragraph>
                {t(
                  'Select a platform, and following snippet instructs the CLI to upload your reports to Sentry Prevent.'
                )}
              </Paragraph>
              <StyledSelectControl
                size="md"
                options={PLATFORM_OPTIONS}
                value={selectedPlatform}
                onChange={(option: {value: Platform}) =>
                  setSelectedPlatform(option.value)
                }
              />
              <CodeSnippet dark language="bash">
                {getBinarySnippet(selectedPlatform)}
              </CodeSnippet>
              {CLILink}
            </Fragment>
          ) : null}
        </OnboardingStep.Content>
      </OnboardingStep.Body>
    </OnboardingStep.Container>
  );
}

const StyledSelectControl = styled(Select)`
  width: 200px;
  margin-bottom: ${p => p.theme.space.lg};
`;

const Paragraph = styled('div')`
  margin-top: ${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.md};
`;

const BottomParagraph = styled('div')`
  margin-top: ${p => p.theme.space.xl};
`;

const CLILink = (
  <BottomParagraph>
    {tct('Learn more about the [cliLink].', {
      cliLink: (
        <ExternalLink href="https://docs.sentry.io/product/test-analytics/sentry-prevent-cli/">
          {t('Sentry Prevent CLI')} <IconOpen size="xs" />
        </ExternalLink>
      ),
    })}
  </BottomParagraph>
);
