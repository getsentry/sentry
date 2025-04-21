import {Fragment} from 'react';

import {Toast, type ToastProps} from 'sentry/components/core/toast';
import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/toast';

function makeToastProps(type: 'success' | 'error' | 'loading' | 'undo'): ToastProps {
  return {
    indicator: {
      type,
      message: 'Successful operation',
      options: {},
      id: 'success-toast',
    },
    onDismiss: () => {
      // eslint-disable-next-line no-alert
      alert('Dismissed!');
    },
  };
}
export default storyBook('Toast', (story, APIReference) => {
  APIReference(types.Toast);

  story('Toast types', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Toast" /> component comes in different types. To display a
          toast, use the <JSXNode name="addSuccessMessage" /> or
          <JSXNode name="addErrorMessage" /> functions from{' '}
          <code>static/app/actionCreators/indicator.tsx</code>.
        </p>
        <SideBySide>
          {(['success', 'error', 'loading', 'undo'] as const).map(type => (
            <Toast key={type} {...makeToastProps(type)} />
          ))}
        </SideBySide>

        <p>Toast support undoable actions.</p>
        <SideBySide>
          {(['success', 'error', 'loading', 'undo'] as const).map(type => {
            const props = makeToastProps(type);
            props.indicator.options.undo = () => {
              // eslint-disable-next-line no-alert
              alert('Undone!');
            };

            return <Toast key={type} {...props} />;
          })}
        </SideBySide>
      </Fragment>
    );
  });
});
