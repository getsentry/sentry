import {Fragment} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import LoadingError from 'sentry/components/loadingError';
import * as Storybook from 'sentry/stories';

export default Storybook.story('LoadingError', story => {
  story('Default', () => {
    return (
      <Fragment>
        <p>
          You can use this <Storybook.JSXNode name="LoadingError" /> to easily render an
          error message if a smaller component on your page fails to load. This is useful
          for rendering a default error message if there's an error returned from a
          <code>useApiQuery</code> call, for example.
        </p>
        <Storybook.SizingWindow style={{height: '150px'}}>
          <LoadingError />
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('Custom message', () => (
    <Storybook.SizingWindow style={{height: '190px'}}>
      <LoadingError message="This component failed to load. Our bad!" />
    </Storybook.SizingWindow>
  ));

  story('With retry', () => (
    <Fragment>
      <p>
        Use the <Storybook.JSXProperty name="onRetry" value={Function} /> property to add
        a callback if you want to allow the user to retry rendering. This could be used
        for retrying a <code>useApiQuery</code> call, for example.
      </p>
      <Storybook.SizingWindow style={{height: '190px'}}>
        <LoadingError
          message="Uh-oh. Try refreshing."
          onRetry={() => addErrorMessage('You can add any callback here.')}
        />
      </Storybook.SizingWindow>
    </Fragment>
  ));
});
