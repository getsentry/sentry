import {Fragment} from 'react';
import documentation from '!!type-loader!sentry/components/core/toast';

import {Toast, type ToastProps} from 'sentry/components/core/toast';
import * as Storybook from 'sentry/stories';

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
export default Storybook.story('Toast', (story, APIReference) => {
  APIReference(documentation.props?.Toast);

  story('Toast types', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="Toast" /> component comes in different types. To
          display a toast, use the <Storybook.JSXNode name="addSuccessMessage" /> or
          <Storybook.JSXNode name="addErrorMessage" /> functions from{' '}
          <code>static/app/actionCreators/indicator.tsx</code>.
        </p>
        <Storybook.SideBySide>
          {(['success', 'error', 'loading', 'undo'] as const).map(type => (
            <Toast key={type} {...makeToastProps(type)} />
          ))}
        </Storybook.SideBySide>

        <p>Toast support undoable actions.</p>
        <Storybook.SideBySide>
          {(['success', 'error', 'loading', 'undo'] as const).map(type => {
            const props = makeToastProps(type);
            props.indicator.options.undo = () => {
              // eslint-disable-next-line no-alert
              alert('Undone!');
            };

            return <Toast key={type} {...props} />;
          })}
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});
