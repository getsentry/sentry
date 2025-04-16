import {Fragment} from 'react';

import {Toast} from 'sentry/components/core/toast';
import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/toast';

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
          <Toast
            indicator={{
              type: 'success' as const,
              message: 'Successful operation',
              options: {},
              id: 'success-toast',
            }}
            onDismiss={() => {
              // eslint-disable-next-line no-alert
              alert('Dismissed!');
            }}
          />
          <Toast
            indicator={{
              type: 'error' as const,
              message: 'Error operation',
              options: {},
              id: 'error-toast',
            }}
            onDismiss={() => {
              // eslint-disable-next-line no-alert
              alert('Dismissed!');
            }}
          />
          <Toast
            indicator={{
              type: 'loading' as const,
              message: 'Loading operation',
              options: {},
              id: 'loading-toast',
            }}
            onDismiss={() => {
              // eslint-disable-next-line no-alert
              alert('Dismissed!');
            }}
          />
          <Toast
            indicator={{
              type: 'undo' as const,
              message: 'Undo operation',
              options: {
                undo: () => {
                  // eslint-disable-next-line no-alert
                  alert('Undo!');
                },
              },
              id: 'undo-toast',
            }}
            onDismiss={() => {
              // eslint-disable-next-line no-alert
              alert('Dismissed!');
            }}
          />
        </SideBySide>
      </Fragment>
    );
  });
});
