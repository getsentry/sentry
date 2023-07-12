import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
   * The language of the code to be rendered (python, javascript, etc)
   */
  language: string;
  /**
   * A brief description of the configuration
   */
  description?: React.ReactNode;
};

export type StepProps = {
  configurations: ConfigurationType[];
  /**
   * The step type (install, configure, verify). The list can grow as we add more steps
   */
  type: StepType;
  /**
   * A brief description of the step
   */
  description?: React.ReactNode;
};

export function Step({type, configurations, description}: StepProps) {
  return (
    <div>
      <h4>{StepTitle[type]}</h4>
      {description}
      <Configurations>
        {configurations.map((configuration, index) => (
          <Configuration key={index}>
            {configuration.description}
            <CodeSnippet dark language={configuration.language}>
              {configuration.language === 'javascript'
                ? beautify.js(configuration.code, {indent_size: 2, e4x: true})
                : beautify.html(configuration.code, {indent_size: 2})}
            </CodeSnippet>
          </Configuration>
        ))}
      </Configurations>
    </div>
  );
}

const Configuration = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Configurations = styled(Configuration)`
  margin-top: ${space(2)};
`;
