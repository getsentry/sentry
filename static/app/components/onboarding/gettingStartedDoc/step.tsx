import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t} from 'sentry/locale';

export enum StepType {
  INSTALL = 'install',
  CONFIGURE = 'configure',
  VERIFY = 'verify',
}

const StepTitle = {
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
      <SyntaxHighlight dark language={type === StepType.INSTALL ? 'bash' : language}>
        {type !== StepType.INSTALL && language === 'javascript'
          ? beautify.js(code, {indent_size: 2, e4x: true})
          : beautify.html(code, {indent_size: 2})}
      </SyntaxHighlight>
    </div>
  );
}

const SyntaxHighlight = styled(CodeSnippet)`
  margin-top: 1em;
  margin-bottom: 1em;
`;
