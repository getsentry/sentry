import {Fragment} from 'react';

import BadStackTraceExample from 'sentry-images/issue_details/bad-stack-trace-example.png';
import GoodStackTraceExample from 'sentry-images/issue_details/good-stack-trace-example.png';

import JSXNode from 'sentry/components/stories/jsxNode';
import storyBook from 'sentry/stories/storyBook';

import {ContentSliderDiff} from '.';

export default storyBook('ContentSliderDiff', story => {
  story('Comparing images', function () {
    return (
      <Fragment>
        <p>
          The <JSXNode name="ContentSliderDiff" /> component compares the before and after
          of visual elements using an adjustable slider. It allows users to dynamically
          see the "before" and "after" sections by dragging a divider.
        </p>
        <p>
          The before and after contents are not directly defined here and have to be
          provided, so it can be very flexible (e.g. images, replays, etc).
        </p>
        <p>
          An example <JSXNode name="ContentSliderDiff" /> using images looks like this:
        </p>
        <div>
          <ContentSliderDiff.Header>
            <ContentSliderDiff.BeforeLabel help="This is the before image" />
            <ContentSliderDiff.AfterLabel help="This is the after image" />
          </ContentSliderDiff.Header>
          <ContentSliderDiff.Body
            before={<img src={BadStackTraceExample} />}
            after={<img src={GoodStackTraceExample} />}
            minHeight="300px"
          />
        </div>
      </Fragment>
    );
  });
});
