import {Fragment, useState} from 'react';
import {Link} from 'react-router-dom';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Select} from 'sentry/components/core/select';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface OutputCoverageFileStepProps {
  step: string;
}

type Frameworks = 'jest' | 'vitest' | 'pytest' | 'phpunit';

const INSTALL_REQUIREMENTS_SNIPPETS: Record<Frameworks, string> = {
  jest: 'npm install --save-dev jest',
  vitest: 'npm install --save-dev vitest @vitest/coverage-v8',
  pytest: 'pip install pytest pytest-cov',
  phpunit: 'composer require --dev phpunit/phpunit',
};

const GENERATE_FILE_SNIPPETS: Record<Frameworks, string> = {
  jest: `npm i --save-dev jest-junit
JEST_JUNIT_CLASSNAME="{filepath}" jest --reporters=jest-junit`,
  vitest: 'vitest --reporter=junit --outputFile=test-report.junit.xml',
  pytest: 'pytest --cov --junitxml=junit.xml -o junit_family=legacy',
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
          <p>
            {tct(
              "Select your language below to generate your testing reports. If your language isn't listed, visit [supported] for your testing framework. Currently, Sentry supports JUnit XML format only.",
              {
                supported: (
                  // TODO: the new version of this link is still TBD
                  <Link to="https://docs.codecov.com/docs/test-analytics#:~:text=Only%20JUnit%20XML%20test%20result%20files%20are%20supported%20at%20the%20moment">
                    {t('supported languages')}
                  </Link>
                ),
              }
            )}
          </p>
          <StyledSelectControl
            size="md"
            options={[
              {label: 'Jest', value: 'jest'},
              {label: 'Vitest', value: 'vitest'},
              {label: 'Pytest', value: 'pytest'},
              {label: 'PHPUnit', value: 'phpunit'},
            ]}
            value={selectedFramework}
            onChange={(option: {value: Frameworks}) => setSelectedFramework(option.value)}
          />
          <StyledInstruction>
            {t('Install requirements in your terminal:')}
          </StyledInstruction>
          <CodeSnippet dark language="bash">
            {INSTALL_REQUIREMENTS_SNIPPETS[selectedFramework]}
          </CodeSnippet>
          {GENERATE_FILE_SNIPPETS[selectedFramework] ? (
            <Fragment>
              <StyledInstruction>
                {t(
                  'Generate a JUnit XML file that contains the results of your test run.'
                )}
              </StyledInstruction>
              <CodeSnippet dark language="bash">
                {GENERATE_FILE_SNIPPETS[selectedFramework]}
              </CodeSnippet>
            </Fragment>
          ) : null}
        </OnboardingStep.Content>
      </OnboardingStep.Body>
    </OnboardingStep.Container>
  );
}

const StyledSelectControl = styled(Select)`
  width: 110px;
  margin-bottom: ${space(1.5)};
`;

const StyledInstruction = styled('p')`
  margin: ${space(1.5)} 0;
`;
