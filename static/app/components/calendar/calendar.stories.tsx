import {Fragment, useState} from 'react';
import type {Range} from 'react-date-range';

import {DatePicker, DateRangePicker} from 'sentry/components/calendar';
import ExternalLink from 'sentry/components/links/externalLink';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('Calendar', story => {
  story('DatePicker', () => {
    const [selected, setSelected] = useState<Date | undefined>(undefined);
    return (
      <Fragment>
        <p>
          The most common props to set are <JSXProperty name="date" value={Date} /> with{' '}
          <JSXProperty name="onChange" value={Function} />.
        </p>
        <p>
          Under the hook we&apos;re using{' '}
          <ExternalLink href="https://github.com/hypeserver/react-date-range">
            react-date-range v1.4.x
          </ExternalLink>
          . Click through to see the props available.
        </p>
        <p>selectedDate={selected ? selected.toISOString() : 'undefined'}</p>
        <DatePicker date={selected} onChange={setSelected} />
      </Fragment>
    );
  });

  story('DateRangePicker', () => {
    const [selected, setSelected] = useState<Range | undefined>(undefined);
    return (
      <Fragment>
        <p>
          <JSXNode name="DateRangePicker" /> accepts{' '}
          <JSXProperty name="startDate" value={Date} />,{' '}
          <JSXProperty name="endDate" value={Date} /> along with{' '}
          <JSXProperty name="onChange" value={Function} /> which accepts a{' '}
          <code>Range</code>.
        </p>
        <p>
          selected.startDate=
          {selected?.startDate ? selected.startDate.toISOString() : 'undefined'}
          <br />
          selected.endDate=
          {selected?.endDate ? selected.endDate.toISOString() : 'undefined'}
        </p>
        <DateRangePicker
          startDate={selected?.startDate}
          endDate={selected?.endDate}
          onChange={setSelected}
        />
      </Fragment>
    );
  });
});
