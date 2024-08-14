import {motion} from 'framer-motion';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconFile} from 'sentry/icons/iconFile';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import ContinueButton from 'sentry/views/relocation/components/continueButton';
import RelocationCodeBlock from 'sentry/views/relocation/components/relocationCodeBlock';
import StepHeading from 'sentry/views/relocation/components/stepHeading';
import Wrapper from 'sentry/views/relocation/components/wrapper';

import type {StepProps} from './types';

export function PublicKey({publicKeys, relocationState, onComplete}: StepProps) {
  const {regionUrl} = relocationState;
  const publicKey = publicKeys.get(regionUrl);
  const handleContinue = (event: any) => {
    event.preventDefault();
    onComplete();
  };

  return (
    <Wrapper data-test-id="public-key">
      <StepHeading step={2}>{t("Save Sentry's public key to your machine")}</StepHeading>
      {publicKey ? (
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
              "To do so, you'll need to save the following public key to a file accessible from wherever your self-hosted repository is currently installed. You'll need to have this public key file available for the next step."
            )}
          </p>
          <RelocationCodeBlock
            dark
            filename="key.pub"
            icon={<IconFile />}
            hideCopyButton={false}
          >
            {publicKey}
          </RelocationCodeBlock>
          <ContinueButton priority="primary" type="submit" onClick={handleContinue} />
        </motion.div>
      ) : (
        <motion.div
          transition={testableTransition()}
          variants={{
            initial: {y: 30, opacity: 0},
            animate: {y: 0, opacity: 1},
            exit: {opacity: 0},
          }}
        >
          <LoadingIndicator />
        </motion.div>
      )}
    </Wrapper>
  );
}

export default PublicKey;
