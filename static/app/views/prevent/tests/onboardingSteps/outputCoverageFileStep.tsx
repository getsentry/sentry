import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {CodeBlock} from '@sentry/scraps/code';
import {ExternalLink} from '@sentry/scraps/link';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface OutputCoverageFileStepProps {
  step: string;
}

type Frameworks = 'jest' | 'vitest' | 'pytest' | 'phpunit';

const INSTALL_REQUIREMENTS_SNIPPETS: Record<Frameworks, string> = {
  jest: 'npm install --save-dev jest',
  vitest: 'npm install --save-dev vitest @vitest/coverage-v8',
  pytest: 'pip install pytest',
  phpunit: 'composer require --dev phpunit/phpunit',
};

const GENERATE_FILE_SNIPPETS: Record<Frameworks, string> = {
  jest: `JEST_JUNIT_CLASSNAME="{filepath}" jest --reporters=jest-junit`,
  vitest: 'vitest --reporter=junit --outputFile=test-report.junit.xml',
  pytest: 'pytest --junitxml=junit.xml -o junit_family=legacy',
  phpunit: './vendor/bin/phpunit --log-junit junit.xml',
};

export function OutputCoverageFileStep({step}: OutputCoverageFileStepProps) {
  const headerText = tct('Step [step]: Output a JUnit XML file in your CI', {
    step,
  });
  const [selectedFramework, setSelectedFramework] = useState<Frameworks>('jest');

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
        <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
        <OnboardingStep.Content>
          <Text>
            {tct(
              "Select your language below to generate your testing reports. If your language isn't listed, see [doc:the Test Analytics documentation] to learn more about how to generate a file with the JUnit XML file format.",
              {
                doc: (
                  <ExternalLink href="https://docs.sentry.io/product/test-analytics/" />
                ),
              }
            )}
          </Text>
          <StyledSelectControl
            size="sm"
            options={[
              {label: 'Jest', value: 'jest'},
              {label: 'Vitest', value: 'vitest'},
              {label: 'Pytest', value: 'pytest'},
              {label: 'PHPUnit', value: 'phpunit'},
            ]}
            value={selectedFramework}
            onChange={(option: {value: Frameworks}) => setSelectedFramework(option.value)}
          />
          <Text>{t('Install requirements in your terminal:')}</Text>
          <CodeBlock dark language="bash">
            {INSTALL_REQUIREMENTS_SNIPPETS[selectedFramework]}
          </CodeBlock>
          {GENERATE_FILE_SNIPPETS[selectedFramework] ? (
            <Fragment>
              <Text>
                {t(
                  'Generate a JUnit XML file that contains the results of your test run.'
                )}
              </Text>
              <CodeBlock dark language="bash">
                {GENERATE_FILE_SNIPPETS[selectedFramework]}
              </CodeBlock>
            </Fragment>
          ) : null}
        </OnboardingStep.Content>
      </OnboardingStep.Body>
    </OnboardingStep.Container>
  );
}

const StyledSelectControl = styled(Select)`
  width: 110px;
`;
