import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {Toast} from '@sentry/scraps/toast';

import IndicatorStore from 'sentry/stores/indicatorStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

type Props = {
  className?: string;
};

function Indicators(props: Props) {
  const items = useLegacyStore(IndicatorStore);

  return (
    <Toasts {...props}>
      {/*
       * "wait": The entering child will wait until the exiting child has animated out.
       * Currently only renders a single child at a time.
       * @link https://www.framer.com/motion/animate-presence/###mode
       */}
      <AnimatePresence mode="wait">
        {items.map(indicator => (
          <Toast
            key={indicator.id}
            onDismiss={() => IndicatorStore.remove(indicator)}
            indicator={indicator}
          />
        ))}
      </AnimatePresence>
    </Toasts>
  );
}

export default Indicators;

const Toasts = styled('div')`
  position: fixed;
  right: 30px;
  bottom: 30px;
  z-index: ${p => p.theme.zIndex.toast};
`;
