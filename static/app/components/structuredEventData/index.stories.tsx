import {Fragment} from 'react';

import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import StructuredEventData from 'sentry/components/structuredEventData';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(StructuredEventData, story => {
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="StructuredEventData" /> component is used to render event
          data in a way that is easy grok. This includes differentiation between boolean
          and null values, as well as rendering collapsible objects and arrays.
        </p>
        <StructuredEventData data="foo" />
        <StructuredEventData data={100} />
        <StructuredEventData data={null} />
        <StructuredEventData data={false} />
        <StructuredEventData data={{foo: 'bar'}} />
        <StructuredEventData data={['one', 2, {three: {four: 'five'}}]} />
      </Fragment>
    );
  });

  story('Annotations', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="meta" value /> property accepts the event{' '}
          <code>_meta</code> and can annotate filtered values with
          <JSXProperty name="withAnnotatedText" value="true" />.
        </p>
        <StructuredEventData
          data={{obj: {foo: '[Filtered]'}}}
          meta={{obj: {foo: {'': {len: 3}}}}}
          withAnnotatedText
        />
      </Fragment>
    );
  });

  story('Custom rendering of value types', () => {
    return (
      <Fragment>
        <p>
          Using the <JSXProperty name="config" value /> property, you can customize when
          and how certain data types are displayed.
        </p>
        <StructuredEventData
          data={{nil: null, bool: 'this_should_look_like_a_boolean'}}
          config={{
            renderNull: () => 'nulllllll',
            isBoolean: value => value === 'this_should_look_like_a_boolean',
          }}
        />
      </Fragment>
    );
  });
});
