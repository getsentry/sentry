import {Fragment, useState} from 'react';
import {Link} from 'react-router-dom';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Select} from 'sentry/components/core/select';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnboardingStep} from 'sentry/views/codecov/tests/onboarding/onboardingStep';

interface OutputCoverageFileProps {
  stepString: string;
}

type Frameworks = 'jest' | 'vitest' | 'pytest' | 'phpunit';

const INSTALL_REQUIREMENTS_SNIPPETS: Record<Frameworks, string> = {
  jest: `pytest --cov --junitxml=junit.xml -o junit_family=legacy`,
  vitest: `vitest --reporter=junit --outputFile=test-report.junit.xml`,
  pytest: `npm i --save-dev jest-junit`,
  phpunit: `./vendor/bin/phpunit --log-junit junit.xml`,
};

const GENERATE_FILE_SNIPPETS: Record<Frameworks, string> = {
  jest: '',
  vitest: '',
  pytest: `JEST_JUNIT_CLASSNAME="{filepath}" jest --reporters=jest-junit`,
  phpunit: '',
};

export function OutputCoverageFile({stepString}: OutputCoverageFileProps) {
  const headerText = tct('Step [stepString]: Output a JUnit XML file in your CI', {
    stepString,
  });
  const [selectedFramework, setSelectedFramework] = useState<Frameworks>('jest');

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
      <OnboardingStep.Content>
        <p>
          {tct(
            "Select your language below to generate your testing reports. If your language isn't listed, visit [supported] for your testing framework. Currently, Sentry supports JUnit XML format only.",
            {
              supported: (
                // TODO: the new version of this link is still TBD
                <Link to="https://docs.codecov.com/docs/test-analytics#:~:text=Only%20JUnit%20XML%20test%20result%20files%20are%20supported%20at%20the%20moment">
                  supported languages
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
            {label: 'PHPunit', value: 'phpunit'},
          ]}
          value={selectedFramework}
          onChange={(option: {value: Frameworks}) => setSelectedFramework(option.value)}
        />
        <StyledP>{t('Install requirements in your terminal:')}</StyledP>
        <CodeSnippet dark language="bash">
          {INSTALL_REQUIREMENTS_SNIPPETS[selectedFramework]}
        </CodeSnippet>
        {GENERATE_FILE_SNIPPETS[selectedFramework] ? (
          <Fragment>
            <StyledP>
              {t('Generate a JUnit XML file that contains the results of your test run.')}
            </StyledP>
            <CodeSnippet dark language="bash">
              {GENERATE_FILE_SNIPPETS[selectedFramework]}
            </CodeSnippet>
          </Fragment>
        ) : null}
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}

const StyledSelectControl = styled(Select)`
  width: 110px;
  margin-bottom: ${space(1.5)};
`;

const StyledP = styled('p')`
  margin: ${space(1.5)} 0;
`;
