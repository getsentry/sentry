import {Fragment} from 'react';

import * as Storybook from 'sentry/components/stories';
import StructuredEventData from 'sentry/components/structuredEventData';

import {useUser} from './useUser';

export default Storybook.story('useUser', story => {
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
