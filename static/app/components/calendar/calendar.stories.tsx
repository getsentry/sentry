import {Fragment} from 'react';

import {DatePicker, DateRangePicker} from 'sentry/components/calendar';
import ExternalLink from 'sentry/components/links/externalLink';
import JSXNode from 'sentry/components/stories/jsxNode';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('Calendar', story => {
  story('DatePicker', () => (
    <Fragment>
      <p>
        Under the hook we're using{' '}
        <ExternalLink href="https://github.com/hypeserver/react-date-range">
          react-date-range v1.4.x
        </ExternalLink>
        . Click through to see the props available.
      </p>
      <DatePicker />
    </Fragment>
  ));

  story('DateRangePicker', () => (
    <Fragment>
      <p>
        <JSXNode name="DateRangePicker" /> has some custom props added.
      </p>
      <DateRangePicker onChange={() => {}} />
    </Fragment>
  ));
});
