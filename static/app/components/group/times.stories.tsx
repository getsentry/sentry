import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';

import Times from './times';

export default Storybook.story('Tours', story => {
  story('Times', () => (
    <Fragment>
      <Times firstSeen="2021-01-01" lastSeen="2021-01-01" />
    </Fragment>
  ));
});
