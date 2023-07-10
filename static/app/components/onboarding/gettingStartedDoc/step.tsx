import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t} from 'sentry/locale';

export enum StepType {
  INSTALL = 'install',
  CONFIGURE = 'configure',
  VERIFY = 'verify',
}

export const StepTitle = {
  [StepType.INSTALL]: t('Install'),
  [StepType.CONFIGURE]: t('Configure'),
  [StepType.VERIFY]: t('Verify'),
};

type Configuration = {
  /**
   * The code snippet to display
   */
  code: string;
  /**
   * A brief description of the step
   */
  description: React.ReactNode;
};

export type StepProps = {
  configurations: Configuration[];
  /**
   * The language of the selected platform (python, javascript, etc)
   */
  language: string;
  /**
   * The step type (install, configure, verify). The list can grow as we add more steps
   */
  type: StepType;
};

export function Step({type, configurations, language}: StepProps) {
  return (
    <div>
      <h4>{StepTitle[type]}</h4>
      <Configurations>
        {configurations.map((configuration, index) => (
          <div key={index}>
            <Description>{configuration.description}</Description>
            <CodeSnippet dark language={language}>
              {language === 'javascript'
                ? beautify.js(configuration.code, {indent_size: 2, e4x: true})
                : beautify.html(configuration.code, {indent_size: 2})}
            </CodeSnippet>
          </div>
        ))}
      </Configurations>
    </div>
  );
}

const Configurations = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Description = styled('div')`
  margin-bottom: 1em;
`;
