import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconFile} from 'sentry/icons/iconFile';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import RelocationCodeBlock from 'sentry/views/relocation/components/relocationCodeBlock';
import StepHeading from 'sentry/views/relocation/components/stepHeading';
import Wrapper from 'sentry/views/relocation/components/wrapper';

import {StepProps} from './types';

export function PublicKey({publicKey, onComplete}: StepProps) {
  const handleContinue = (event: any) => {
    event.preventDefault();
    onComplete();
  };

  const loaded = (
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
      <ContinueButton priority="primary" type="submit" onClick={handleContinue}>
        {t('Continue')}
      </ContinueButton>
    </motion.div>
  );

  const unloaded = (
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
  );

  return (
    <Wrapper>
      <StepHeading step={2}>{t("Save Sentry's public key to your machine")}</StepHeading>
      {publicKey ? loaded : unloaded}
    </Wrapper>
  );
}

export default PublicKey;

const ContinueButton = styled(Button)`
  margin-top: ${space(1.5)};
`;
