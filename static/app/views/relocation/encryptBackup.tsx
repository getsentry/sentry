import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import StepHeading from 'sentry/views/relocation/components/stepHeading';

import {StepProps} from './types';

export function EncryptBackup(props: StepProps) {
  const code =
    './sentry-admin.sh export global --encrypt-with /path/to/public_key.pub\n/path/to/encrypted/backup/file.tar';
  return (
    <Wrapper>
      <StepHeading step={3}>
        {t('Create an encrypted backup of current self-hosted instance')}
      </StepHeading>
      <motion.div
        transition={testableTransition()}
        variants={{
          initial: {y: 30, opacity: 0},
          animate: {y: 0, opacity: 1},
          exit: {opacity: 0},
        }}
      >
        <p>
          {t(
            'You’ll need to have the public key saved in the previous step accessible when you run the following command in your terminal. Make sure your current working directory is the root of your `self-hosted` install when you execute it.'
          )}
        </p>
        <EncryptCodeSnippet
          dark
          language="bash"
          filename=">_ TERMINAL"
          hideCopyButton={false}
        >
          {code}
        </EncryptCodeSnippet>
        <p className="encrypt-help">
          <b>{t('Understanding the command:')}</b>
        </p>
        <p>
          <mark>{'./sentry-admin.sh'}</mark>
          {t('this is a script present in your self-hosted installation')}
        </p>
        <p>
          <mark>{'/path/to/public/key/file.pub'}</mark>
          {t('path to file you created in the previous step')}
        </p>
        <p>
          <mark>{'/path/to/encrypted/backup/output/file.tar'}</mark>
          {t('file that will be uploaded in the next step')}
        </p>
        <ContinueButton size="md" priority="primary" onClick={() => props.onComplete()}>
          {t('Continue')}
        </ContinueButton>
      </motion.div>
    </Wrapper>
  );
}

export default EncryptBackup;

const EncryptCodeSnippet = styled(CodeSnippet)`
  margin: ${space(2)} 0 ${space(4)};
  padding: 4px;
`;

const Wrapper = styled('div')`
  max-width: 769px;
  max-height: 525px;
  margin-left: auto;
  margin-right: auto;
  padding: ${space(4)};
  background-color: #ffffff;
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  width: 100%;
  color: #80708f;
  mark {
    border-radius: 8px;
    padding: ${space(0.25)} ${space(0.5)} ${space(0.25)} ${space(0.5)};
    background: #f0ecf3;
    margin-right: ${space(1)};
  }
  h2 {
    color: #4d4158;
  }
  p {
    margin-bottom: ${space(1)};
  }
  .encrypt-help {
    color: #4d4158;
  }
`;

const ContinueButton = styled(Button)`
  margin-top: ${space(1.5)};
`;
