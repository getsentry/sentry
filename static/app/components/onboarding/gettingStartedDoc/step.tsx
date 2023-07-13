import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export enum StepType {
  INSTALL = 'install',
  CONFIGURE = 'configure',
  VERIFY = 'verify',
}

export const StepTitle = {
  [StepType.INSTALL]: t('Install'),
  [StepType.CONFIGURE]: t('Configure SDK'),
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
   * Additional information to be displayed below the code snippet
   */
  additionalInfo?: React.ReactNode;
  /**
   * A brief description of the configuration
   */
  description?: React.ReactNode;
};

interface BaseStepProps {
  configurations?: ConfigurationType[];
  /**
   * A brief description of the step
   */
  description?: React.ReactNode;
}
interface StepPropsWithTitle extends BaseStepProps {
  title: string;
  type?: undefined;
}

interface StepPropsWithoutTitle extends BaseStepProps {
  type: StepType;
  title?: undefined;
}

export type StepProps = StepPropsWithTitle | StepPropsWithoutTitle;

export function Step({title, type, configurations, description}: StepProps) {
  return (
    <div>
      <h4>{title ?? StepTitle[type]}</h4>
      {description && <Description>{description}</Description>}
      {!!configurations?.length && (
        <Configurations>
          {configurations.map((configuration, index) => (
            <Configuration key={index}>
              {configuration.description && (
                <Description>{configuration.description}</Description>
              )}
              <CodeSnippet dark language={configuration.language}>
                {configuration.language === 'javascript'
                  ? beautify.js(configuration.code, {indent_size: 2, e4x: true})
                  : beautify.html(configuration.code, {indent_size: 2})}
              </CodeSnippet>
              {configuration.additionalInfo && (
                <AdditionalInfo>{configuration.additionalInfo}</AdditionalInfo>
              )}
            </Configuration>
          ))}
        </Configurations>
      )}
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

const Description = styled(Configuration)``;

const AdditionalInfo = styled(Configuration)``;
