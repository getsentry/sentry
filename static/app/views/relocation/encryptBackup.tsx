import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from 'sentry/components/button';
import {IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import RelocationCodeBlock from 'sentry/views/relocation/components/relocationCodeBlock';
import StepHeading from 'sentry/views/relocation/components/stepHeading';
import Wrapper from 'sentry/views/relocation/components/wrapper';

import {StepProps} from './types';

export function EncryptBackup(props: StepProps) {
  const code =
    './sentry-admin.sh export global --encrypt-with /path/to/public_key.pub\n/path/to/encrypted/backup/file.tar';
  return (
    <Wrapper>
      <StepHeading step={3}>
        {t('Create an encrypted backup of your current self-hosted instance')}
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
        <RelocationCodeBlock
          dark
          language="bash"
          filename="TERMINAL"
          icon={<IconTerminal />}
          hideCopyButton={false}
        >
          {code}
        </RelocationCodeBlock>
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
        <ContinueButton priority="primary" onClick={() => props.onComplete()}>
          {t('Continue')}
        </ContinueButton>
      </motion.div>
    </Wrapper>
  );
}

export default EncryptBackup;

const ContinueButton = styled(Button)`
  margin-top: ${space(1.5)};
`;
