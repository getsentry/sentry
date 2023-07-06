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

export type StepProps = {
  code: string;
  description: React.ReactNode;
  language: string;
  type: StepType;
};

export function Step({type, description, language, code}: StepProps) {
  return (
    <div>
      <h4>{StepTitle[type]}</h4>
      <p>{description}</p>
      <CodeSnippet dark language={language}>
        {language === 'javascript'
          ? beautify.js(code, {indent_size: 2, e4x: true})
          : beautify.html(code, {indent_size: 2})}
      </CodeSnippet>
    </div>
  );
}
