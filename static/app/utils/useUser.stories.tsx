import {Fragment} from 'react';

import StructuredEventData from 'sentry/components/structuredEventData';
import storyBook from 'sentry/stories/storyBook';

import {useUser} from './useUser';

export default storyBook('useUser', story => {
  story('useUser', () => {
    const user = useUser();

    return (
      <Fragment>
        <p>
          <code>useUser</code> returns the currently logged in user.
        </p>
        <StructuredEventData data={user} />
      </Fragment>
    );
  });
});
