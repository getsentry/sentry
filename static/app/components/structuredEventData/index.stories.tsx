import {Fragment, useState} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import Matrix from 'sentry/components/stories/matrix';
import StructuredEventData from 'sentry/components/structuredEventData';
import StoryBook from 'sentry/stories/storyBook';

export default StoryBook('StructuredEventData', Story => {
  Story('Default', () => {
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
        <StructuredEventData data={{foo: 'bar', arr: [1, 2, 3, 4, 5, 6]}} />
        <StructuredEventData data={['one', 2, null]} />
      </Fragment>
    );
  });

  Story('Auto-Expanded items', () => (
    <Matrix
      propMatrix={{
        data: [
          {
            foo: 'bar',
            'the_real_world?': {
              the_city: {
                the_hotel: {
                  the_fortress: 'a pinwheel',
                },
              },
            },
            arr5: [1, 2, 3, 4, 5],
            arr6: [1, 2, 3, 4, 5, 6],
          },
        ],
        forceDefaultExpand: [undefined, true, false],
        maxDefaultDepth: [undefined, 0, 1, 2, 3],
      }}
      render={StructuredEventData}
      selectedProps={['forceDefaultExpand', 'maxDefaultDepth']}
    />
  ));

  Story('Manually expanded items', () => {
    const data = {
      foo: 'bar',
      'the_real_world?': {
        the_city: {
          the_hotel: {
            the_fortress: 'a pinwheel',
          },
        },
      },
      arr5: [1, 2, 3, 4, 5],
      arr6: [1, 2, 3, 4, 5, 6],
    };
    return (
      <Story.SideBySide>
        <div>
          <p>Nothing</p>
          <StructuredEventData data={data} initialExpandedPaths={[]} />
        </div>
        <div>
          <p>Root only</p>
          <StructuredEventData data={data} initialExpandedPaths={['$']} />
        </div>
        <div>
          <p>1st level</p>
          <StructuredEventData
            data={data}
            initialExpandedPaths={['$', '$.the_real_world?', '$.arr5', '$.arr6']}
          />
        </div>
        <div>
          <p>Depth first</p>
          <StructuredEventData
            data={data}
            initialExpandedPaths={[
              '$',
              '$.the_real_world?',
              '$.the_real_world?.the_city',
              '$.the_real_world?.the_city.the_hotel',
              '$.the_real_world?.the_city.the_hotel.the_fortress',
            ]}
          />
        </div>
      </Story.SideBySide>
    );
  });

  Story('onToggleExpand', () => {
    const [state, setState] = useState<string[]>();
    return (
      <Fragment>
        <p>
          You can keep track of the expanded/collapsed state so the component looks the
          same even if it's re-rendered on the screen at a later time (like in a virtual
          scrolling list).
        </p>
        <p>
          The <JSXProperty name="onToggleExpand" value={Function} /> callback is not
          triggered on mount.
        </p>
        <p>Current expanded state: {JSON.stringify(state, null, '\t')}</p>
        <StructuredEventData
          data={{foo: 'bar', arr: [1, 2, 3, 4, 5, 6]}}
          onToggleExpand={expandedPaths => setState(expandedPaths)}
        />
      </Fragment>
    );
  });

  Story('Annotations', () => {
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

  Story('Custom rendering of value types', () => {
    return (
      <Fragment>
        <p>
          Using the <JSXProperty name="config" value /> property, you can customize when
          and how certain data types are displayed.
        </p>
        <p>Input:</p>
        <CodeSnippet language="javascript">{`data: {nil: null, bool: 'this_should_look_like_a_boolean'}`}</CodeSnippet>
        <p>Config:</p>
        <CodeSnippet language="javascript">
          {`const config = {
  renderNull: () => 'nulllllll',
  isBoolean: value => value === 'this_should_look_like_a_boolean',
}`}
        </CodeSnippet>
        <p>Output:</p>
        <StructuredEventData
          data={{nil: null, bool: 'this_should_look_like_a_boolean'}}
          config={{
            renderNull: () => 'nulllllll',
            isBoolean: value => value === 'this_should_look_like_a_boolean',
          }}
        />
        <p>
          By default, strings within object values will render without quotes around them,
          as you can see in the example above. In order to render values with quotes (or
          any other custom formatting), you can set the <code>isString</code>
          <JSXProperty name=" config" value /> with something like this:
        </p>
        <CodeSnippet language="javascript">
          {`const config = {
  isString: (v: any) => {
    return typeof v === 'string';
  },
}; `}
        </CodeSnippet>
      </Fragment>
    );
  });

  Story('Allow copy to clipboard', () => {
    return (
      <Fragment>
        <p>
          Using the <JSXProperty name="showCopyButton" value /> property and
          <JSXProperty name="onCopy" value /> callback, you can customize whether to show
          a copy to clipboard button, and what happens when copy is pressed.
        </p>
        <StructuredEventData
          data={{red: 'fish', blue: 'fish'}}
          showCopyButton
          onCopy={() => {
            addSuccessMessage('Copied successfully!');
          }}
        />
      </Fragment>
    );
  });
});
