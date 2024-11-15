import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {removeIndicator} from 'sentry/actionCreators/indicator';
import ToastIndicator from 'sentry/components/alerts/toastIndicator';
import IndicatorStore from 'sentry/stores/indicatorStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

const Toasts = styled('div')`
  position: fixed;
  right: 30px;
  bottom: 30px;
  z-index: ${p => p.theme.zIndex.toast};
`;

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
          <ToastIndicator
            onDismiss={removeIndicator}
            indicator={indicator}
            key={indicator.id}
          />
        ))}
      </AnimatePresence>
    </Toasts>
  );
}

export default Indicators;
