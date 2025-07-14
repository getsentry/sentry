import {Fragment, useState} from 'react';
import type {Range} from 'react-date-range';

import {DatePicker, DateRangePicker} from 'sentry/components/calendar';
import ExternalLink from 'sentry/components/links/externalLink';
import * as Storybook from 'sentry/stories';

export default Storybook.story('Calendar', story => {
  story('DatePicker', () => {
    const [selected, setSelected] = useState<Date | undefined>(undefined);
    return (
      <Fragment>
        <p>
          The most common props to set are{' '}
          <Storybook.JSXProperty name="date" value={Date} /> with{' '}
          <Storybook.JSXProperty name="onChange" value={Function} />.
        </p>
        <p>
          Under the hood we're using{' '}
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
          <Storybook.JSXNode name="DateRangePicker" /> accepts{' '}
          <Storybook.JSXProperty name="startDate" value={Date} />,{' '}
          <Storybook.JSXProperty name="endDate" value={Date} /> along with{' '}
          <Storybook.JSXProperty name="onChange" value={Function} /> which accepts a{' '}
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
