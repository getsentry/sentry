import {motion} from 'framer-motion';

import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import testableTransition from 'sentry/utils/testableTransition';
import Wrapper from 'sentry/views/relocation/components/wrapper';

import type {StepProps} from './types';

export function InProgress(props: StepProps) {
  const userIdentity = ConfigStore.get('userIdentity');

  return (
    <Wrapper data-test-id="in-progress">
      <motion.h2>{t('Your relocation is under way!')}</motion.h2>
      <motion.div
        transition={testableTransition()}
        variants={{
          initial: {y: 30, opacity: 0},
          animate: {y: 0, opacity: 1},
          exit: {opacity: 0},
        }}
      >
        <p>
          {`Your relocation is currently being processed - we\'ll email the latest updates to ${userIdentity.email}. If you don't hear back from us in 24 hours, please `}
          <a href="https://sentry.zendesk.com/hc/en-us">contact support</a>.
        </p>
        <hr />
        <p>
          UUID: <i>{props.existingRelocationUUID}</i>
        </p>
      </motion.div>
    </Wrapper>
  );
}

export default InProgress;
