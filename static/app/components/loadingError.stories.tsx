import {Fragment} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import LoadingError from 'sentry/components/loadingError';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('LoadingError', story => {
  story('Default', () => {
    return (
      <Fragment>
        <p>
          You can use this <JSXNode name="LoadingError" /> to easily render an error
          message if a smaller component on your page fails to load. This is useful for
          rendering a default error message if there's an error returned from a
          <code>useApiQuery</code> call, for example.
        </p>
        <SizingWindow style={{height: '150px'}}>
          <LoadingError />
        </SizingWindow>
      </Fragment>
    );
  });

  story('Custom message', () => (
    <SizingWindow style={{height: '190px'}}>
      <LoadingError message="This component failed to load. Our bad!" />
    </SizingWindow>
  ));

  story('With retry', () => (
    <Fragment>
      <p>
        Use the <JSXProperty name="onRetry" value={Function} /> property to add a callback
        if you want to allow the user to retry rendering. This could be used for retrying
        a <code>useApiQuery</code> call, for example.
      </p>
      <SizingWindow style={{height: '190px'}}>
        <LoadingError
          message="Uh-oh. Try refreshing."
          onRetry={() => addErrorMessage('You can add any callback here.')}
        />
      </SizingWindow>
    </Fragment>
  ));
});
