import {Fragment, useState} from 'react';

import StructuredEventData from 'sentry/components/structuredEventData';
import * as Storybook from 'sentry/stories';
import usePrevious from 'sentry/utils/usePrevious';

export default Storybook.story('usePrevious', story => {
  story('Default', () => {
    const [count, setCount] = useState(0);
    const prevCount = usePrevious(count);

    return (
      <Fragment>
        <p>
          Use <code>usePrevious</code> to keep track of the previous state.
        </p>
        <button onClick={() => setCount(prev => prev + 1)}>Add 1</button>
        <StructuredEventData data={{count, prevCount}} />;
      </Fragment>
    );
  });

  story('Stacked', () => {
    const [count, setCount] = useState(0);
    const prevCount = usePrevious(count);
    const penultimateCount = usePrevious(prevCount);

    return (
      <Fragment>
        <p>
          You can even stack <code>usePrevious</code> to keep track of the penultimate
          states.
        </p>
        <button onClick={() => setCount(prev => prev + 1)}>Add 1</button>
        <StructuredEventData data={{count, prevCount, penultimateCount}} />;
      </Fragment>
    );
  });
});
