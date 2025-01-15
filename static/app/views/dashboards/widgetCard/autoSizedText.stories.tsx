import {Fragment} from 'react';
import styled from '@emotion/styled';

import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';

export default storyBook(AutoSizedText, story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="AutoSizedText" /> is a helper component that automatically sizes
          a piece of text (single line only!) against its parent. It iteratively measures
          the size of the parent element, and chooses a font size for the child element to
          fit it perfectly (within reason) inside the parent. For example:
        </p>

        <SmallSizingWindow>
          <AutoSizedText>
            <OneLineSpan>NEWSFLASH, y&apos;all!</OneLineSpan>
          </AutoSizedText>
        </SmallSizingWindow>

        <p>
          This was built for the &quot;Big Number&quot; widget in our Dashboards product.
          It&apos;s not possible to <i>perfectly</i> size the text using only CSS and
          HTML!
        </p>
        <p>
          To use <JSXNode name="AutoSizedText" />, set it as the child of positioned
          element of known dimensions. Pass the content you want to size as the{' '}
          <strong>
            <code>children</code>
          </strong>
          prop. <JSXNode name="AutoSizedText" /> will set the font size of its children to
          fit into the parent.
        </p>
      </Fragment>
    );
  });
});

const SmallSizingWindow = styled(SizingWindow)`
  width: 300px;
  height: 200px;
`;

const OneLineSpan = styled('span')`
  white-space: nowrap;
`;
