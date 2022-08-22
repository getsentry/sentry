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
      <AnimatePresence>
        {items.map((indicator, i) => (
          // We purposefully use `i` as key here because of transitions
          // Toasts can now queue up, so when we change from [firstToast] -> [secondToast],
          // we don't want to  animate `firstToast` out and `secondToast` in, rather we want
          // to replace `firstToast` with `secondToast`
          <ToastIndicator onDismiss={removeIndicator} indicator={indicator} key={i} />
        ))}
      </AnimatePresence>
    </Toasts>
  );
}

export default Indicators;
