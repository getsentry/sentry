import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Select} from 'sentry/components/core/select';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnboardingStep} from 'sentry/views/codecov/tests/onboardingSteps/onboardingStep';

interface OutputCoverageFileProps {
  step: string;
}

type Method = 'pip' | 'binary';

// TODO: confirm these platform choices
type Platform = 'macOS' | 'Linux' | 'Windows';

const SNIPPET = `snippet still tbd`;

export function InstallPreventCLI({step}: OutputCoverageFileProps) {
  const [method, setMethod] = useState<Method>('pip');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('macOS');

  const headerText = tct(
    'Step [step]: Install the [preventLink] to your CI environment',
    {
      step,
      preventLink: (
        <Link to="https://docs.sentry.io/platforms/python/prevent/cli/">
          {t('Sentry Prevent CLI')}
        </Link>
      ),
    }
  );

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
      <OnboardingStep.Content>
        <RadioGroup
          label="install method"
          value={method}
          onChange={setMethod}
          choices={[
            ['pip', t('Using pip (for Python users)')],
            ['binary', t('Using a Binary')],
          ]}
        />
        {method === 'pip' ? (
          <Fragment>
            <p>
              {t(
                'If you have Python installed already, you can run the script below to install the Sentry Prevent CLI'
              )}
            </p>
            <CodeSnippet dark language="bash">
              {SNIPPET}
            </CodeSnippet>
            <p>
              {tct('Learn more about the [cliLink]', {
                cliLink: (
                  <Link to="https://docs.sentry.io/platforms/python/prevent/cli/">
                    {t('Sentry CLI Link')}
                  </Link>
                ),
              })}
            </p>
          </Fragment>
        ) : null}
        {method === 'binary' ? (
          <Fragment>
            <p>
              {t(
                'Select a platform, and following snippet instructs the CLI to upload your reports to Sentry Prevent.'
              )}
            </p>
            <StyledSelectControl
              size="md"
              options={[
                {label: 'macOS', value: 'MacOS'},
                {label: 'Linux', value: 'Linux'},
                {label: 'Windows', value: 'Windows'},
              ]}
              value={selectedPlatform}
              onChange={(option: {value: Platform}) => setSelectedPlatform(option.value)}
            />
            <CodeSnippet dark language="bash">
              {SNIPPET}
            </CodeSnippet>
            <p>
              {tct('Learn more about the [cliLink]', {
                cliLink: (
                  <Link to="https://docs.sentry.io/platforms/python/prevent/cli/">
                    {t('Sentry CLI Link')}
                  </Link>
                ),
              })}
            </p>
          </Fragment>
        ) : null}
        {/* TODO: add dropdown expansion */}
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}

const StyledSelectControl = styled(Select)`
  width: 110px;
  margin-bottom: ${space(1.5)};
`;
