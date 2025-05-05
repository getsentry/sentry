import {Fragment} from 'react';

import BadStackTraceExample from 'sentry-images/issue_details/bad-stack-trace-example.png';
import GoodStackTraceExample from 'sentry-images/issue_details/good-stack-trace-example.png';

import {Flex} from 'sentry/components/container/flex';
import QuestionTooltip from 'sentry/components/questionTooltip';
import JSXNode from 'sentry/components/stories/jsxNode';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

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
            <Flex align="center" gap={space(0.5)}>
              Before
              <QuestionTooltip title="This is the before image" size="xs" />
            </Flex>
            <Flex align="center" gap={space(0.5)}>
              After
              <QuestionTooltip title="This is the after image" size="xs" />
            </Flex>
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
