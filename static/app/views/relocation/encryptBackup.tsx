import {motion} from 'framer-motion';

import {IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import ContinueButton from 'sentry/views/relocation/components/continueButton';
import RelocationCodeBlock from 'sentry/views/relocation/components/relocationCodeBlock';
import StepHeading from 'sentry/views/relocation/components/stepHeading';
import Wrapper from 'sentry/views/relocation/components/wrapper';

import type {StepProps} from './types';

export function EncryptBackup(props: StepProps) {
  const code =
    'SENTRY_DOCKER_IO_DIR=/path/to/key ./sentry-admin.sh \\\nexport global --encrypt-with /sentry-admin/key.pub /sentry-admin/export.tar';
  return (
    <Wrapper data-test-id="encrypt-backup">
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
            'You’ll need to have the public key saved in the previous step accessible when you run the following command in your terminal. Make sure your current working directory is the root of your '
          )}
          <mark>self-hosted</mark>
          {t('install when you execute it.')}
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
          {t('The ')}
          <mark>{'SENTRY_DOCKER_IO_DIR=/path/to/key/dir'}</mark>
          {t(
            'environment variable maps the local directory where you saved your public key in the previous step to a '
          )}
          <mark>{'/sentry-admin'}</mark>
          {t('volume in your Docker container. ')}
          <mark>{'./sentry-admin.sh'}</mark>
          {t('is a script included by default with your ')}
          <mark>{'self-hosted'}</mark>
          {t(
            'installation which contains a number of administrative tools. One of these is the'
          )}
          <mark>{'export global'}</mark>
          {t('command for backing up all Sentry data. ')}
          <mark>{'--encrypt-with /sentry-admin/key.pub'}</mark>
          {t('encrypts the data using our public key, and ')}
          <mark>{'/sentry-admin/export.tar'}</mark>
          {t(
            "is the name of the output tarball. This is what you'll upload in the next step."
          )}
        </p>
        <p className="encrypt-note">
          <i>
            {t('Note: Depending on your system configuration, you may need to use ')}
            <mark>sudo -E</mark>
            {t('for this command.')}
          </i>
        </p>
        <ContinueButton priority="primary" onClick={() => props.onComplete()} />
      </motion.div>
    </Wrapper>
  );
}

export default EncryptBackup;
