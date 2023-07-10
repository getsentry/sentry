import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t} from 'sentry/locale';

export enum StepType {
  INSTALL = 'install',
  CONFIGURE = 'configure',
  /**
   * This step is used only for JavaScript SDKs
   */
  UPLOAD_SOURCE_MAPS = 'upload_source_maps',
  VERIFY = 'verify',
}

export const StepTitle = {
  [StepType.INSTALL]: t('Install'),
  [StepType.CONFIGURE]: t('Configure SDK'),
  [StepType.UPLOAD_SOURCE_MAPS]: t('Upload Source Maps'),
  [StepType.VERIFY]: t('Verify'),
};

type ConfigurationType = {
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
  configurations: ConfigurationType[];
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
            <p>{configuration.description}</p>
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
